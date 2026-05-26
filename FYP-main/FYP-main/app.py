from flask import Flask, request, jsonify, render_template, send_file
import os
import json
import uuid
import hashlib
import pandas as pd
from io import StringIO, BytesIO
from datetime import datetime

app = Flask(__name__)

# ════════════════════════════════════════════════════════════════
# JSON FILE PATHS
# ════════════════════════════════════════════════════════════════
DATA_FOLDER = "data"
os.makedirs(DATA_FOLDER, exist_ok=True)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

SUPERMARKETS_FILE = os.path.join(DATA_FOLDER, "supermarkets.json")
GOV_STORES_FILE   = os.path.join(DATA_FOLDER, "gov_registered_stores.json")

def _load_json(path, default):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return default

def _save_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2, default=str)

def load_supermarkets():
    return _load_json(SUPERMARKETS_FILE, {"supermarkets": {}})

def save_supermarkets(data):
    _save_json(SUPERMARKETS_FILE, data)

def load_gov_stores():
    return _load_json(GOV_STORES_FILE, {"stores": []})

def save_gov_stores(data):
    _save_json(GOV_STORES_FILE, data)

def hash_password(pw):
    return hashlib.sha256(pw.encode()).hexdigest()

# ════════════════════════════════════════════════════════════════
# CARBON CONFIG
# ════════════════════════════════════════════════════════════════
CARBON_TABLE = {
    "Dairy": 1.9,
    "Plastic": 3.5,
    "Electronics": 8.2,
    "Food": 2.1,
    "Textile": 4.0
}

THRESHOLD = 200  # kg CO2 threshold for violations

last_analysis_data = {}
current_user_session = {}

# ════════════════════════════════════════════════════════════════
# ROUTES
# ════════════════════════════════════════════════════════════════
@app.route("/")
def home():
    return render_template("index.html")


# ──── AUTH ────

@app.route("/api/signup", methods=["POST"])
def signup():
    data = request.json
    username  = data.get("username", "").strip()
    password  = data.get("password", "")
    org       = data.get("organization", "").strip()
    email     = data.get("email", "").strip()
    role      = data.get("role")

    if role != "supermarket":
        return jsonify({"success": False, "message": "Invalid role"}), 400

    if not all([username, password, org, email]):
        return jsonify({"success": False, "message": "All fields are required"}), 400

    if len(password) < 6:
        return jsonify({"success": False, "message": "Password must be at least 6 characters"}), 400

    db = load_supermarkets()
    for sm in db["supermarkets"].values():
        if sm["username"] == username:
            return jsonify({"success": False, "message": "Username already exists"}), 400

    sm_id = "SM-" + str(uuid.uuid4())[:8].upper()
    record = {
        "id":                 sm_id,
        "username":           username,
        "password":           hash_password(password),
        "organization":       org,
        "email":              email,
        "registered_at":      datetime.now().isoformat(),
        "total_emission":     0,
        "total_units":        0,
        "avg_emission":       0,
        "highest_impact":     "",
        "last_upload":        None,
        "risk_breakdown":     {"Normal": 0, "Critical": 0, "High-Risk": 0},
        "category_emissions": {},
        "source_emissions":   {},
        "high_risk_products": [],
        "suggestions":        [],
        "all_products":       [],
        "compliance_status":  "Compliant"
    }

    db["supermarkets"][sm_id] = record
    save_supermarkets(db)

    # Register in gov portal
    gov = load_gov_stores()
    gov_entry = {
        "store_id":          sm_id,
        "organization":      org,
        "email":             email,
        "username":          username,
        "registered_at":     datetime.now().isoformat(),
        "total_emission":    0,
        "compliance_status": "Compliant",
        "reports_submitted": 0
    }
    gov["stores"].append(gov_entry)
    save_gov_stores(gov)

    return jsonify({"success": True, "supermarket_id": sm_id, "message": "Account created successfully"})


@app.route("/api/login", methods=["POST"])
def login():
    data     = request.json
    username = data.get("username", "")
    password = data.get("password", "")
    role     = data.get("role")

    if role == "supermarket":
        db = load_supermarkets()
        for sm_id, sm in db["supermarkets"].items():
            if sm["username"] == username and sm["password"] == hash_password(password):
                current_user_session["role"]         = "supermarket"
                current_user_session["user_id"]      = sm_id
                current_user_session["organization"] = sm["organization"]
                return jsonify({
                    "success":      True,
                    "id":           sm_id,
                    "organization": sm["organization"],
                    "username":     username
                })
        # demo fallback
        if username == "demo" and password == "demo123":
            demo_id = "SM-DEMO0001"
            current_user_session["role"]         = "supermarket"
            current_user_session["user_id"]      = demo_id
            current_user_session["organization"] = "Demo Supermarket"
            return jsonify({"success": True, "id": demo_id, "organization": "Demo Supermarket", "username": "demo"})
        return jsonify({"success": False, "message": "Invalid credentials"}), 401

    elif role == "government":
        if username == "gov" and password == "gov123":
            current_user_session["role"]    = "government"
            current_user_session["user_id"] = "GOV-001"
            return jsonify({"success": True, "id": "GOV-001", "organization": "Ministry of Environment"})
        return jsonify({"success": False, "message": "Invalid government credentials"}), 401

    return jsonify({"success": False, "message": "Invalid role"}), 400


# ──── SUPERMARKET ────

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

    if not {"Category", "Units_Sold", "Product"}.issubset(df.columns):
        return jsonify({"error": "File must contain Product, Category, Units_Sold columns"}), 400

    total_emission = 0
    product_results = []
    has_source = "ProductionSource" in df.columns
    has_id     = "ProductID" in df.columns

    category_emissions = {}
    source_emissions   = {}
    risk_counts = {"Normal": 0, "Critical": 0, "High-Risk": 0}
    total_units = 0
    max_emission_product = {"name": "-", "emission": 0}

    for _, row in df.iterrows():
        category = str(row["Category"]).strip()
        try:
            units = float(row["Units_Sold"])
        except (ValueError, TypeError):
            units = 0

        product  = str(row["Product"]).strip()
        prod_id  = str(row["ProductID"]).strip() if has_id else "N/A"
        source   = str(row["ProductionSource"]).strip() if has_source else "Unknown"

        emission_per_unit = CARBON_TABLE.get(category, 0)
        product_total = units * emission_per_unit
        total_emission += product_total
        total_units    += units

        if product_total > max_emission_product["emission"]:
            max_emission_product = {"name": product, "emission": product_total}

        risk_level = "Normal"
        if emission_per_unit > 3 and units > 100:
            risk_level = "High-Risk"
        elif product_total > 500:
            risk_level = "High-Risk"
        elif product_total > 200:
            risk_level = "Critical"

        risk_counts[risk_level] = risk_counts.get(risk_level, 0) + 1

        category_emissions[category] = category_emissions.get(category, 0) + product_total
        source_emissions[source]     = source_emissions.get(source, 0) + product_total

        product_results.append({
            "id":                prod_id,
            "product":           product,
            "category":          category,
            "source":            source,
            "units":             units,
            "emission_per_unit": emission_per_unit,
            "total_emission":    round(product_total, 2),
            "risk_level":        risk_level
        })

    high_risk_items = [p for p in product_results if p["risk_level"] == "High-Risk"]
    avg_emission    = round(total_emission / total_units, 2) if total_units > 0 else 0
    compliance_status = "Non-Compliant" if total_emission > THRESHOLD else "Compliant"
    highest_impact  = max_emission_product["name"]

    suggestions = _generate_suggestions(high_risk_items)

    global last_analysis_data
    last_analysis_data = {
        "total_emission":     round(total_emission, 2),
        "total_units":        int(total_units),
        "avg_emission":       avg_emission,
        "highest_impact":     highest_impact,
        "risk_breakdown":     risk_counts,
        "category_emissions": category_emissions,
        "source_emissions":   source_emissions,
        "high_risk_report":   high_risk_items,
        "suggestions":        suggestions,
        "all_products":       product_results,
        "upload_date":        datetime.now().isoformat(),
        "compliance_status":  compliance_status
    }

    # Persist to supermarket record (FIX: now saves all fields needed for restoration)
    user_id = current_user_session.get("user_id")
    if user_id and not user_id.startswith("SM-DEMO"):
        db = load_supermarkets()
        if user_id in db["supermarkets"]:
            sm = db["supermarkets"][user_id]
            sm["total_emission"]     = round(total_emission, 2)
            sm["total_units"]        = int(total_units)
            sm["avg_emission"]       = avg_emission
            sm["highest_impact"]     = highest_impact           # FIX: persist
            sm["last_upload"]        = datetime.now().isoformat()
            sm["risk_breakdown"]     = risk_counts
            sm["category_emissions"] = category_emissions
            sm["source_emissions"]   = source_emissions         # FIX: persist
            sm["high_risk_products"] = high_risk_items
            sm["suggestions"]        = suggestions              # FIX: persist
            sm["all_products"]       = product_results
            sm["compliance_status"]  = compliance_status
            db["supermarkets"][user_id] = sm
            save_supermarkets(db)

        # Update gov portal
        gov = load_gov_stores()
        for entry in gov["stores"]:
            if entry["store_id"] == user_id:
                entry["total_emission"]     = round(total_emission, 2)
                entry["compliance_status"]  = compliance_status
                entry["reports_submitted"]  = entry.get("reports_submitted", 0) + 1
                entry["last_upload"]        = datetime.now().isoformat()
                entry["category_emissions"] = category_emissions
                entry["risk_breakdown"]     = risk_counts
                break
        save_gov_stores(gov)

    return jsonify({
        "total_emission":     round(total_emission, 2),
        "total_units":        int(total_units),
        "avg_emission":       avg_emission,
        "highest_impact":     highest_impact,
        "risk_breakdown":     risk_counts,
        "category_emissions": category_emissions,
        "source_emissions":   source_emissions,
        "high_risk_report":   high_risk_items,
        "suggestions":        suggestions,
        "all_products":       product_results,
        "gov_submission":     {"success": True, "message": "Report submitted to government portal"}
    })


def _generate_suggestions(high_risk_items):
    alternatives = {
        "Plastic":     ("Biodegradable Packaging", 60),
        "Electronics": ("Refurbished Electronics", 40),
        "Textile":     ("Organic Cotton Products", 35),
        "Dairy":       ("Plant-Based Alternatives", 45),
        "Food":        ("Locally Sourced Items", 25),
    }
    suggestions = []
    for item in high_risk_items[:5]:
        cat = item["category"]
        alt, pct = alternatives.get(cat, ("Eco-Alternative", 30))
        suggestions.append({
            "original_product":    item["product"],
            "category":            cat,
            "alternative_product": alt,
            "reduction_potential": item["total_emission"],
            "reduction_pct":       pct,
            "risk_analysis":       f"High CO₂ emitter at {item['total_emission']} kg",
            "confidence":          "High",
            "narrative":           f"Switching from <strong>{item['product']}</strong> to <strong>{alt}</strong> can reduce emissions by up to {pct}%."
        })
    return suggestions


@app.route("/download-compliance-report")
def download_compliance_report():
    if not last_analysis_data or not last_analysis_data.get("high_risk_report"):
        return jsonify({"error": "No data available"}), 400
    df = pd.DataFrame(last_analysis_data["high_risk_report"])
    buf = StringIO(); df.to_csv(buf, index=False)
    return send_file(BytesIO(buf.getvalue().encode()), mimetype="text/csv", as_attachment=True,
                     download_name=f"compliance_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")


@app.route("/download-full-emission-report")
def download_full_emission_report():
    if not last_analysis_data or not last_analysis_data.get("all_products"):
        return jsonify({"error": "No data available"}), 400
    df = pd.DataFrame(last_analysis_data["all_products"])
    buf = StringIO(); df.to_csv(buf, index=False)
    return send_file(BytesIO(buf.getvalue().encode()), mimetype="text/csv", as_attachment=True,
                     download_name=f"full_emission_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")


@app.route("/download-ai-recommendations-report")
def download_ai_recommendations_report():
    if not last_analysis_data or not last_analysis_data.get("suggestions"):
        return jsonify({"error": "No recommendations available"}), 400
    rows = []
    for s in last_analysis_data["suggestions"]:
        rows.append({
            "Original Product":      s.get("original_product"),
            "Category":              s.get("category"),
            "Alternative":           s.get("alternative_product"),
            "Current Emission (kg)": s.get("reduction_potential"),
            "Reduction (%)":         s.get("reduction_pct"),
            "Confidence":            s.get("confidence")
        })
    df = pd.DataFrame(rows)
    buf = StringIO(); df.to_csv(buf, index=False)
    return send_file(BytesIO(buf.getvalue().encode()), mimetype="text/csv", as_attachment=True,
                     download_name=f"ai_recommendations_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")


# ──── GOVERNMENT ────

@app.route("/api/gov/statistics")
def get_government_statistics():
    db  = load_supermarkets()
    gov = load_gov_stores()
    supermarkets = list(db["supermarkets"].values())

    total_emission = sum(sm.get("total_emission", 0) for sm in supermarkets)
    total_stores   = len(supermarkets)
    non_compliant  = [sm for sm in supermarkets if sm.get("compliance_status") == "Non-Compliant"]
    compliant      = total_stores - len(non_compliant)

    category_totals = {}
    for sm in supermarkets:
        for cat, val in sm.get("category_emissions", {}).items():
            category_totals[cat] = category_totals.get(cat, 0) + val

    top_emitters = sorted(
        [{"organization": sm["organization"], "id": sm["id"],
          "total_emission": sm.get("total_emission", 0),
          "compliance_status": sm.get("compliance_status", "Compliant")}
         for sm in supermarkets],
        key=lambda x: x["total_emission"], reverse=True
    )[:10]

    violations = []
    for sm in supermarkets:
        for prod in sm.get("high_risk_products", []):
            violations.append({
                "company":        sm["organization"],
                "store_id":       sm["id"],
                "product":        prod.get("product"),
                "category":       prod.get("category"),
                "total_emission": prod.get("total_emission"),
                "risk_level":     prod.get("risk_level")
            })

    return jsonify({
        "total_emission":         round(total_emission, 2),
        "total_stores":           total_stores,
        "non_compliant_count":    len(non_compliant),
        "compliant_count":        compliant,
        "avg_reduction":          12,
        "category_emissions":     category_totals,
        "top_emitters":           top_emitters,
        "high_risk_supermarkets": non_compliant,
        "violations":             violations,
        "gov_stores":             gov["stores"]
    })


@app.route("/api/gov/supermarkets")
def get_supermarkets_list():
    db = load_supermarkets()
    result = []
    for sm in db["supermarkets"].values():
        entry = {k: v for k, v in sm.items() if k != "password"}
        result.append(entry)
    return jsonify({"supermarkets": result})


@app.route("/api/gov/supermarket/<sm_id>")
def get_supermarket_details(sm_id):
    db = load_supermarkets()
    sm = db["supermarkets"].get(sm_id)
    if not sm:
        return jsonify({"error": "Not found"}), 404
    entry = {k: v for k, v in sm.items() if k != "password"}
    return jsonify(entry)


@app.route("/api/gov/violations")
def get_violations():
    stats      = get_government_statistics().get_json()
    violations = stats.get("violations", [])
    return jsonify({"violations": violations, "total_violations": len(violations)})


if __name__ == "__main__":
    app.run(debug=True)