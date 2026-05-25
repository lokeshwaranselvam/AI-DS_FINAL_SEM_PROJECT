from flask import Flask, request, jsonify, render_template, send_file
import os
import pandas as pd
from io import StringIO, BytesIO
from datetime import datetime
from recommender import CarbonRecommender
from gov_portal_sync import GovPortalSync

app = Flask(__name__)

# Helper Directories
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

DATA_FOLDER = "data"
os.makedirs(DATA_FOLDER, exist_ok=True)

# Initialize Recommender and Government Portal Sync
recommender = CarbonRecommender()
gov_portal = GovPortalSync()

CARBON_TABLE = {
    "Dairy": 1.9,
    "Plastic": 3.5,
    "Electronics": 8.2,
    "Food": 2.1,
    "Textile": 4.0
}

# Store last analysis results for CSV downloads
last_analysis_data = {}

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

    # Store analysis data for CSV exports
    global last_analysis_data
    last_analysis_data = {
        "total_emission": round(total_emission, 2),
        "total_units": int(total_units),
        "avg_emission": avg_emission,
        "highest_impact": max_emission_product["name"],
        "risk_breakdown": risk_counts,
        "category_emissions": category_emissions,
        "source_emissions": source_emissions,
        "high_risk_report": high_risk_items,
        "suggestions": suggestions,
        "all_products": product_results,
        "upload_date": datetime.now().isoformat()
    }

    # *** AUTO-SUBMIT TO GOVERNMENT PORTAL ***
    gov_response = gov_portal.submit_high_risk_report(high_risk_items, store_id="SAMPLE_SUPERMARKET_001")
    
    response_data = {
        "total_emission": round(total_emission, 2),
        "total_units": int(total_units),
        "avg_emission": avg_emission,
        "highest_impact": max_emission_product["name"],
        "risk_breakdown": risk_counts,
        "category_emissions": category_emissions,
        "source_emissions": source_emissions,
        "high_risk_report": high_risk_items,
        "suggestions": suggestions,
        "gov_submission": gov_response
    }
    
    return jsonify(response_data)

@app.route("/download-compliance-report", methods=["GET"])
def download_compliance_report():
    """Download Compliance Report (High-Risk Items) as CSV"""
    if not last_analysis_data or not last_analysis_data.get("high_risk_report"):
        return jsonify({"error": "No analysis data available. Please upload and analyze data first."}), 400
    
    high_risk_items = last_analysis_data.get("high_risk_report", [])
    
    df = pd.DataFrame(high_risk_items)
    csv_buffer = StringIO()
    df.to_csv(csv_buffer, index=False)
    
    return send_file(
        BytesIO(csv_buffer.getvalue().encode()),
        mimetype="text/csv",
        as_attachment=True,
        download_name=f"compliance_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    )

@app.route("/download-full-emission-report", methods=["GET"])
def download_full_emission_report():
    """Download Full Emission Report (All Products) as CSV"""
    if not last_analysis_data or not last_analysis_data.get("all_products"):
        return jsonify({"error": "No analysis data available. Please upload and analyze data first."}), 400
    
    all_products = last_analysis_data.get("all_products", [])
    
    # Add summary at the top
    summary_data = {
        "Total CO₂ (kg)": last_analysis_data.get("total_emission", 0),
        "Total Units Sold": last_analysis_data.get("total_units", 0),
        "Avg Emission/Unit": last_analysis_data.get("avg_emission", 0),
        "Analysis Date": last_analysis_data.get("upload_date", ""),
        "": "",  # Empty row for separation
    }
    
    df_summary = pd.DataFrame([summary_data])
    df_products = pd.DataFrame(all_products)
    
    csv_buffer = StringIO()
    csv_buffer.write("=== EMISSION SUMMARY ===\n")
    df_summary.to_csv(csv_buffer, index=False)
    csv_buffer.write("\n=== ALL PRODUCTS ===\n")
    df_products.to_csv(csv_buffer, index=False)
    
    return send_file(
        BytesIO(csv_buffer.getvalue().encode()),
        mimetype="text/csv",
        as_attachment=True,
        download_name=f"full_emission_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    )

@app.route("/download-ai-recommendations-report", methods=["GET"])
def download_ai_recommendations_report():
    """Download AI Recommendations Report as CSV"""
    if not last_analysis_data or not last_analysis_data.get("suggestions"):
        return jsonify({"error": "No recommendations available. Please upload and analyze data first."}), 400
    
    suggestions = last_analysis_data.get("suggestions", [])
    
    # Flatten the nested structure for CSV
    csv_data = []
    for suggestion in suggestions:
        csv_data.append({
            "Original Product": suggestion.get("original_product", ""),
            "Category": suggestion.get("category", ""),
            "Alternative Product": suggestion.get("alternative_product", ""),
            "Current Emission (kg CO₂e)": suggestion.get("reduction_potential", 0),
            "Reduction Potential (%)": suggestion.get("reduction_pct", 0),
            "Risk Analysis": suggestion.get("risk_analysis", ""),
            "Confidence": suggestion.get("confidence", ""),
            "Recommendation": suggestion.get("narrative", "").replace("<strong>", "").replace("</strong>", "")
        })
    
    df = pd.DataFrame(csv_data)
    csv_buffer = StringIO()
    df.to_csv(csv_buffer, index=False)
    
    return send_file(
        BytesIO(csv_buffer.getvalue().encode()),
        mimetype="text/csv",
        as_attachment=True,
        download_name=f"ai_recommendations_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    )

@app.route("/gov-submission-status", methods=["GET"])
def gov_submission_status():
    """Get status of government portal submissions"""
    submission_log = gov_portal.get_submission_history()
    return jsonify({
        "submissions": submission_log,
        "total_submissions": len(submission_log)
    })

if __name__ == "__main__":
    app.run(debug=True)
