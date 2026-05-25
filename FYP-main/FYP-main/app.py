from flask import Flask, request, jsonify, render_template, send_file
import os
import pandas as pd
from io import StringIO, BytesIO
from datetime import datetime
from recommender import CarbonRecommender
from gov_portal_sync import GovPortalSync
from user_database import UserDatabase

app = Flask(__name__)

# Helper Directories
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

DATA_FOLDER = "data"
os.makedirs(DATA_FOLDER, exist_ok=True)

# Initialize modules
recommender = CarbonRecommender()
gov_portal = GovPortalSync()
user_db = UserDatabase()

CARBON_TABLE = {
    "Dairy": 1.9,
    "Plastic": 3.5,
    "Electronics": 8.2,
    "Food": 2.1,
    "Textile": 4.0
}

# Store last analysis results for CSV downloads and current user session
last_analysis_data = {}
current_user_session = {}

@app.route("/")
def home():
    return render_template("index.html")

# ════════════════════════════════════════════════════════════════
# AUTHENTICATION ENDPOINTS
# ════════════════════════════════════════════════════════════════

@app.route("/api/signup", methods=["POST"])
def signup():
    """Handle supermarket signup"""
    data = request.json
    username = data.get("username")
    password = data.get("password")
    organization = data.get("organization")
    email = data.get("email")
    role = data.get("role")
    
    if role == "supermarket":
        if not all([username, password, organization, email]):
            return jsonify({"success": False, "message": "All fields required"}), 400
        
        result = user_db.register_supermarket(username, password, organization, email)
        return jsonify(result), 200 if result["success"] else 400
    
    return jsonify({"success": False, "message": "Invalid role"}), 400

@app.route("/api/login", methods=["POST"])
def login():
    """Handle user login"""
    data = request.json
    username = data.get("username")
    password = data.get("password")
    role = data.get("role")
    
    if role == "supermarket":
        result = user_db.login_supermarket(username, password)
        if result["success"]:
            current_user_session["role"] = "supermarket"
            current_user_session["user_id"] = result["id"]
            current_user_session["organization"] = result["organization"]
        return jsonify(result), 200 if result["success"] else 401
    
    elif role == "government":
        # Demo government login
        if username == "gov" and password == "gov123":
            current_user_session["role"] = "government"
            current_user_session["user_id"] = "GOV-001"
            return jsonify({
                "success": True,
                "id": "GOV-001",
                "organization": "Ministry of Environment"
            }), 200
    
    return jsonify({"success": False, "message": "Invalid credentials"}), 401

# ════════════════════════════════════════════════════════════════
# SUPERMARKET PORTAL ENDPOINTS
# ════════════════════════════════════════════════════════════════

@app.route("/upload-file", methods=["POST"])
def upload_file():
    """Analyze uploaded emission data and auto-submit to government portal"""
    
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
    
    has_source = "ProductionSource" in df.columns
    has_id = "ProductID" in df.columns

    category_emissions = {}
    source_emissions = {}
    risk_counts = {"Normal": 0, "Critical": 0, "High-Risk": 0}
    
    total_units = 0
    max_emission_product = {"name": "-", "emission": 0}

    for _, row in df.iterrows():
        category = str(row["Category"]).strip()
        
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

        if product_total > max_emission_product["emission"]:
            max_emission_product = {"name": product, "emission": product_total}

        risk_level = "Normal"
        if emission_per_unit > 3 and units > 100:
            risk_level = "High-Risk"
        elif product_total > 500:
            risk_level = "High-Risk"
        elif product_total > 200:
            risk_level = "Critical"
        
        risk_counts[risk_level] += 1
        
        if category in category_emissions:
            category_emissions[category] += product_total
        else:
            category_emissions[category] = product_total
            
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

    high_risk_items = [p for p in product_results if p["risk_level"] == "High-Risk"]
    suggestions = recommender.get_suggestions(high_risk_items)
    
    avg_emission = round(total_emission / total_units, 2) if total_units > 0 else 0

    # Store analysis data
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

    # Update supermarket user database
    user_id = current_user_session.get("user_id")
    if user_id:
        user_db.update_supermarket_emissions(user_id, last_analysis_data)

    # Auto-submit to government portal
    supermarket_name = current_user_session.get("organization", "SUPERMARKET")
    gov_response = gov_portal.submit_high_risk_report(high_risk_items, store_id=user_id or "SUPERMARKET")
    
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
        return jsonify({"error": "No analysis data available"}), 400
    
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
        return jsonify({"error": "No analysis data available"}), 400
    
    all_products = last_analysis_data.get("all_products", [])
    
    summary_data = {
        "Total CO₂ (kg)": last_analysis_data.get("total_emission", 0),
        "Total Units Sold": last_analysis_data.get("total_units", 0),
        "Avg Emission/Unit": last_analysis_data.get("avg_emission", 0),
        "Analysis Date": last_analysis_data.get("upload_date", ""),
        "": "",
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
        return jsonify({"error": "No recommendations available"}), 400
    
    suggestions = last_analysis_data.get("suggestions", [])
    
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

# ════════════════════════════════════════════════════════════════
# GOVERNMENT PORTAL ENDPOINTS
# ════════════════════════════════════════════════════════════════

@app.route("/api/gov/statistics", methods=["GET"])
def get_government_statistics():
    """Get national aggregate statistics for government dashboard"""
    stats = user_db.get_government_statistics()
    return jsonify(stats)

@app.route("/api/gov/supermarkets", methods=["GET"])
def get_supermarkets_list():
    """Get all registered supermarkets with their data"""
    supermarkets = user_db.get_all_supermarkets()
    # Remove passwords before sending to frontend
    for sm in supermarkets:
        sm.pop("password", None)
    return jsonify({"supermarkets": supermarkets})

@app.route("/api/gov/supermarket/<supermarket_id>", methods=["GET"])
def get_supermarket_details(supermarket_id):
    """Get detailed information about a specific supermarket"""
    details = user_db.get_supermarket_details(supermarket_id)
    if details:
        details.pop("password", None)
        return jsonify(details)
    return jsonify({"error": "Supermarket not found"}), 404

@app.route("/api/gov/violations", methods=["GET"])
def get_violations():
    """Get list of high-risk supermarkets and their violations"""
    stats = user_db.get_government_statistics()
    violations = stats.get("high_risk_supermarkets", [])
    return jsonify({"violations": violations, "total_violations": len(violations)})

if __name__ == "__main__":
    app.run(debug=True)
