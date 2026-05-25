from flask import Flask, request, jsonify, render_template
import os
import pandas as pd
from recommender import CarbonRecommender

app = Flask(__name__)

# Helper Directories
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

DATA_FOLDER = "data"
os.makedirs(DATA_FOLDER, exist_ok=True)

# Initialize Recommender
recommender = CarbonRecommender()

CARBON_TABLE = {
    "Dairy": 1.9,
    "Plastic": 3.5,
    "Electronics": 8.2,
    "Food": 2.1,
    "Textile": 4.0
}

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/upload-file", methods=["POST"])
def upload_file():

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(file_path)

    if file.filename.endswith(".csv"):
        df = pd.read_csv(file_path)
    else:
        df = pd.read_excel(file_path)

    if "Category" not in df.columns or "Units_Sold" not in df.columns or "Product" not in df.columns:
        return jsonify({"error": "File must contain Product, Category, Units_Sold columns"}), 400

    total_emission = 0
    product_results = []
    
    # Validation for new columns (Optional but good practice)
    has_source = "ProductionSource" in df.columns
    has_id = "ProductID" in df.columns

    # Category Breakdown for Chart.js
    category_emissions = {}
    source_emissions = {} # For Bar Chart
    risk_counts = {"Normal": 0, "Critical": 0, "High-Risk": 0}
    
    # Summary Metrics
    total_units = 0
    max_emission_product = {"name": "-", "emission": 0}

    for _, row in df.iterrows():
        category = str(row["Category"]).strip()
        
        # Robust parsing for Units_Sold
        try:
             units = float(row["Units_Sold"])
        except ValueError:
             units = 0
             
        product = str(row["Product"]).strip()
        prod_id = str(row["ProductID"]).strip() if has_id else "N/A"
        source = str(row["ProductionSource"]).strip() if has_source else "Unknown"

        emission_per_unit = CARBON_TABLE.get(category, 0)
        product_total = units * emission_per_unit
        total_emission += product_total
        total_units += units

        # Track Highest Impact
        if product_total > max_emission_product["emission"]:
            max_emission_product = {"name": product, "emission": product_total}

        # --- Classification Rules ---
        # Normal: Low emission (< 200 total) OR Low sales (< 50 units) - Simplified logic
        # Critical: High emission (> 200 total) AND Moderate sales
        # High-Risk: High emission (> 500 total) OR (High Unit Emission > 3 AND Sales > 100)
        
        # Refined Rules based on README intent:
        risk_level = "Normal"
        if emission_per_unit > 3 and units > 100:
             risk_level = "High-Risk"
        elif product_total > 500: # High total impact
             risk_level = "High-Risk"
        elif product_total > 200:
             risk_level = "Critical"
        
        risk_counts[risk_level] += 1
        
        # Add to Category Breakdown
        if category in category_emissions:
            category_emissions[category] += product_total
        else:
            category_emissions[category] = product_total
            
        # Add to Source Breakdown
        if source in source_emissions:
            source_emissions[source] += product_total
        else:
            source_emissions[source] = product_total

        item_data = {
            "id": prod_id,
            "product": product,
            "category": category,
            "source": source,
            "units": units,
            "emission_per_unit": emission_per_unit,
            "total_emission": round(product_total, 2),
            "risk_level": risk_level
        }
        product_results.append(item_data)

    # Filter High-Risk items for Recommender and Government Report
    high_risk_items = [p for p in product_results if p["risk_level"] == "High-Risk"]
    
    # Get Suggestions
    suggestions = recommender.get_suggestions(high_risk_items)
    
    avg_emission = round(total_emission / total_units, 2) if total_units > 0 else 0

    return jsonify({
        "total_emission": round(total_emission, 2),
        "total_units": int(total_units),
        "avg_emission": avg_emission,
        "highest_impact": max_emission_product["name"],
        "risk_breakdown": risk_counts,
        "category_emissions": category_emissions, # For Pie Chart
        "source_emissions": source_emissions,     # For Bar Chart
        "high_risk_report": high_risk_items,      # For Government Report Table
        "suggestions": suggestions                # For Recommendations
    })

if __name__ == "__main__":
    app.run(debug=True)
