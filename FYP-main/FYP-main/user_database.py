"""
User & Supermarket Database Manager
Handles storage and retrieval of supermarket registrations and their emission data
"""

import json
import os
from datetime import datetime
from typing import Dict, List, Optional
import uuid

class UserDatabase:
    def __init__(self, db_path="data/users.json"):
        """Initialize user database"""
        self.db_path = db_path
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self._ensure_db_exists()
    
    def _ensure_db_exists(self):
        """Create database file if it doesn't exist"""
        if not os.path.exists(self.db_path):
            with open(self.db_path, 'w') as f:
                json.dump({"supermarkets": [], "government": []}, f, indent=2)
    
    def register_supermarket(self, username: str, password: str, organization: str, email: str) -> Dict:
        """
        Register a new supermarket user
        
        Args:
            username: Username
            password: Password (should be hashed in production)
            organization: Supermarket name
            email: Email address
            
        Returns:
            Dictionary with registration status and supermarket ID
        """
        with open(self.db_path, 'r') as f:
            data = json.load(f)
        
        # Check if user already exists
        for sm in data["supermarkets"]:
            if sm["username"] == username:
                return {"success": False, "message": "Username already exists"}
        
        supermarket_id = f"SM-{str(uuid.uuid4())[:8].upper()}"
        
        new_supermarket = {
            "id": supermarket_id,
            "username": username,
            "password": password,  # In production, this should be hashed
            "organization": organization,
            "email": email,
            "registered_at": datetime.now().isoformat(),
            "total_emissions": 0,
            "total_products": 0,
            "analysis_count": 0,
            "last_upload": None,
            "analysis_history": []
        }
        
        data["supermarkets"].append(new_supermarket)
        
        with open(self.db_path, 'w') as f:
            json.dump(data, f, indent=2)
        
        return {
            "success": True,
            "message": "Supermarket registered successfully",
            "supermarket_id": supermarket_id
        }
    
    def login_supermarket(self, username: str, password: str) -> Dict:
        """Authenticate supermarket user"""
        with open(self.db_path, 'r') as f:
            data = json.load(f)
        
        for sm in data["supermarkets"]:
            if sm["username"] == username and sm["password"] == password:
                return {
                    "success": True,
                    "id": sm["id"],
                    "organization": sm["organization"],
                    "email": sm["email"]
                }
        
        return {"success": False, "message": "Invalid credentials"}
    
    def update_supermarket_emissions(self, supermarket_id: str, analysis_data: Dict) -> Dict:
        """
        Update supermarket with new emission analysis
        
        Args:
            supermarket_id: ID of supermarket
            analysis_data: Analysis results
            
        Returns:
            Updated supermarket data
        """
        with open(self.db_path, 'r') as f:
            data = json.load(f)
        
        for sm in data["supermarkets"]:
            if sm["id"] == supermarket_id:
                sm["total_emissions"] = analysis_data.get("total_emission", 0)
                sm["total_products"] = analysis_data.get("total_units", 0)
                sm["last_upload"] = datetime.now().isoformat()
                sm["analysis_count"] = sm.get("analysis_count", 0) + 1
                
                # Store analysis history
                analysis_record = {
                    "timestamp": datetime.now().isoformat(),
                    "total_emission": analysis_data.get("total_emission", 0),
                    "total_units": analysis_data.get("total_units", 0),
                    "avg_emission": analysis_data.get("avg_emission", 0),
                    "high_risk_count": len(analysis_data.get("high_risk_report", [])),
                    "risk_breakdown": analysis_data.get("risk_breakdown", {}),
                    "category_emissions": analysis_data.get("category_emissions", {})
                }
                sm["analysis_history"].append(analysis_record)
                
                with open(self.db_path, 'w') as f:
                    json.dump(data, f, indent=2)
                
                return {"success": True, "supermarket": sm}
        
        return {"success": False, "message": "Supermarket not found"}
    
    def get_all_supermarkets(self) -> List[Dict]:
        """Get all registered supermarkets"""
        with open(self.db_path, 'r') as f:
            data = json.load(f)
        
        return data["supermarkets"]
    
    def get_supermarket_details(self, supermarket_id: str) -> Optional[Dict]:
        """Get detailed information about a specific supermarket"""
        with open(self.db_path, 'r') as f:
            data = json.load(f)
        
        for sm in data["supermarkets"]:
            if sm["id"] == supermarket_id:
                return sm
        
        return None
    
    def get_government_statistics(self) -> Dict:
        """
        Calculate aggregate statistics for government portal
        
        Returns:
            National level statistics across all supermarkets
        """
        with open(self.db_path, 'r') as f:
            data = json.load(f)
        
        supermarkets = data["supermarkets"]
        
        if not supermarkets:
            return {
                "total_supermarkets": 0,
                "national_total_emissions": 0,
                "national_total_products": 0,
                "avg_emissions_per_supermarket": 0,
                "supermarkets": [],
                "high_risk_supermarkets": []
            }
        
        total_emissions = sum(sm.get("total_emissions", 0) for sm in supermarkets)
        total_products = sum(sm.get("total_products", 0) for sm in supermarkets)
        
        # Identify high-risk supermarkets
        high_risk = []
        for sm in supermarkets:
            avg_per_product = (sm.get("total_emissions", 0) / sm.get("total_products", 1)) if sm.get("total_products", 0) > 0 else 0
            if avg_per_product > 3.0:  # Threshold for high-risk
                high_risk.append({
                    "id": sm["id"],
                    "organization": sm["organization"],
                    "total_emissions": sm.get("total_emissions", 0),
                    "avg_per_product": round(avg_per_product, 2),
                    "risk_level": "High" if avg_per_product > 5 else "Medium"
                })
        
        return {
            "total_supermarkets": len(supermarkets),
            "national_total_emissions": round(total_emissions, 2),
            "national_total_products": int(total_products),
            "avg_emissions_per_supermarket": round(total_emissions / len(supermarkets), 2) if supermarkets else 0,
            "supermarkets": supermarkets,
            "high_risk_supermarkets": sorted(high_risk, key=lambda x: x["total_emissions"], reverse=True),
            "compliance_rate": round((1 - len(high_risk) / len(supermarkets)) * 100, 1) if supermarkets else 0
        }
