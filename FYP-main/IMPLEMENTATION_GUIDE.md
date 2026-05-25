# CarbonLens - Implementation Summary

## System Architecture

### 1. **Supermarket Portal (Supermarket Registration & Data Submission)**

#### Key Features:
- **User Signup**: Supermarkets can register with:
  - Username & Password
  - Organization name (Supermarket name)
  - Email address
  - Auto-generated unique Supermarket ID (SM-XXXXXXXX)

- **Data Upload & Analysis**:
  - Upload CSV/XLSX files with product data
  - Automatic carbon emission calculation
  - Risk classification (Normal/Critical/High-Risk)
  - AI-powered substitution recommendations

- **Report Downloads** (3 types):
  1. **Compliance Report** - High-risk items only
  2. **Full Emission Report** - All products with summary
  3. **AI Recommendations Report** - Alternative products with reduction potential

- **Auto-Submission to Government**:
  - When data is uploaded, high-risk items automatically sync to government portal
  - Supermarket added to government's supermarket list
  - Emission data stored for aggregation

### 2. **Government Portal (National Dashboard)**

#### Key Features:
- **National Overview Dashboard**:
  - Total national CO₂ emissions
  - Number of registered supermarkets
  - Compliance rate (% of compliant supermarkets)
  - High-risk supermarket count

- **Supermarket List View**:
  - All registered supermarkets with their emission data
  - Click on supermarket to view detailed carbon emission profile
  - Real-time updates from supermarket submissions

- **Detailed Supermarket Profile** (when clicked):
  - Total emissions
  - Total products tracked
  - Analysis history with timestamps
  - Category-wise emission breakdown
  - Risk distribution
  - Last upload date

- **Violations & Analytics**:
  - High-risk supermarkets flagged
  - Emission trend analysis
  - Category breakdown across all supermarkets
  - Regional compliance rates

### 3. **Data Storage (JSON-based)**

#### File Structure: `data/users.json`
```json
{
  "supermarkets": [
    {
      "id": "SM-ABC12345",
      "username": "supermarket_user",
      "password": "hashed_password",
      "organization": "Supermarket Name",
      "email": "user@example.com",
      "registered_at": "2026-05-25T...",
      "total_emissions": 1250.50,
      "total_products": 340,
      "analysis_count": 5,
      "last_upload": "2026-05-25T...",
      "analysis_history": [
        {
          "timestamp": "2026-05-25T...",
          "total_emission": 1250.50,
          "total_units": 340,
          "avg_emission": 3.68,
          "high_risk_count": 12,
          "risk_breakdown": {"Normal": 200, "Critical": 50, "High-Risk": 90},
          "category_emissions": {"Dairy": 380, "Plastic": 450}
        }
      ]
    }
  ],
  "government": []
}
```

### 4. **API Endpoints**

#### Authentication:
- `POST /api/signup` - Register new supermarket
- `POST /api/login` - User login

#### Supermarket Portal:
- `POST /upload-file` - Upload and analyze emission data
- `GET /download-compliance-report` - Download high-risk items CSV
- `GET /download-full-emission-report` - Download all products CSV
- `GET /download-ai-recommendations-report` - Download recommendations CSV

#### Government Portal:
- `GET /api/gov/statistics` - National aggregate statistics
- `GET /api/gov/supermarkets` - List all registered supermarkets
- `GET /api/gov/supermarket/<id>` - Detailed supermarket profile
- `GET /api/gov/violations` - High-risk violations list

### 5. **Data Flow**

```
Supermarket User
      ↓
   [Signup] → Store in users.json
      ↓
   [Login] → Session created
      ↓
   [Upload CSV] → Analyze emissions
      ↓
   [Auto-sync] → Government Portal
      ↓
Government View:
   - Dashboard shows all supermarkets
   - Click supermarket → View detailed emissions
   - Analytics based on all submitted data
```

### 6. **Key Modules**

1. **app.py** - Flask backend with all endpoints
2. **user_database.py** - User registration & JSON storage
3. **gov_portal_sync.py** - Government data synchronization
4. **recommender.py** - AI recommendations engine
5. **index.html** - Frontend with signup/login forms

### 7. **Authentication Flow**

#### Supermarket:
1. Click "Supermarket" portal
2. Choose "Sign Up"
3. Enter credentials (auto-registered in users.json)
4. Login with credentials
5. Dashboard appears
6. Upload data → Auto-syncs to government

#### Government:
1. Click "Government" portal
2. Login (demo: gov/gov123)
3. Dashboard shows all supermarkets
4. Click on supermarket name → View detailed emissions
5. View violations & analytics

### 8. **Government Dashboard Data Sources**

All data is **dynamically generated** from registered supermarkets:
- ✅ No hardcoded default data
- ✅ Real emission data from supermarket submissions
- ✅ Automatic aggregation
- ✅ Live updates when supermarkets upload data

### 9. **Compliance Tracking**

- Supermarkets with avg emission > 3.0 kg CO₂e/product are flagged
- High-risk vs Medium-risk categorization
- Compliance rate calculated as: (compliant supermarkets / total supermarkets) × 100

---

## Usage Instructions

### For Supermarket:
1. **Sign Up**: Register your supermarket
2. **Upload Data**: CSV with columns (Product, Category, Units_Sold, ProductionSource, ProductID)
3. **View Dashboard**: See emission analysis & charts
4. **Download Reports**: Export compliance, full emission, and AI recommendations as CSV
5. **Auto-Sync**: Data automatically submitted to government

### For Government:
1. **Login**: Access national dashboard
2. **View Statistics**: See aggregate national emissions
3. **Browse Companies**: View all registered supermarkets
4. **Click Supermarket**: See detailed emission profile
5. **Analyze Violations**: Check non-compliant supermarkets

---

## Future Enhancements

- Password hashing (bcrypt)
- Database migration (SQLite/PostgreSQL)
- Email verification for signup
- Advanced analytics & predictive models
- Multi-language support
- Mobile app
