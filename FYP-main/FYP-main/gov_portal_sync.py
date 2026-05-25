"""
Government Portal Sync Module
Handles submission of high-risk emission data to government reporting systems.
"""

import requests
import json
from datetime import datetime
from typing import List, Dict

class GovPortalSync:
    def __init__(self, gov_api_url="https://gov-portal.example.com/api"):
        """
        Initialize Government Portal sync service.
        
        Args:
            gov_api_url: Base URL for government portal API endpoint
        """
        self.gov_api_url = gov_api_url
        self.submission_log = []
        
    def submit_high_risk_report(self, high_risk_items: List[Dict], store_id: str = "STORE_001") -> Dict:
        """
        Submit high-risk products to government portal for compliance tracking.
        
        Args:
            high_risk_items: List of high-risk product dictionaries
            store_id: Unique identifier for the store
            
        Returns:
            Dictionary containing submission status and reference ID
        """
        if not high_risk_items:
            return {
                "status": "skipped",
                "message": "No high-risk items to report",
                "submitted_items": 0
            }
        
        # Prepare government report payload
        gov_report = self._format_gov_report(high_risk_items, store_id)
        
        try:
            # Submit to government portal
            response = self._send_to_gov_api(gov_report)
            
            if response.get("success"):
                # Log successful submission
                self.submission_log.append({
                    "timestamp": datetime.now().isoformat(),
                    "store_id": store_id,
                    "items_count": len(high_risk_items),
                    "status": "success",
                    "reference_id": response.get("reference_id")
                })
                
                return {
                    "status": "success",
                    "message": "Successfully submitted to government portal",
                    "reference_id": response.get("reference_id"),
                    "submitted_items": len(high_risk_items),
                    "timestamp": datetime.now().isoformat()
                }
            else:
                return {
                    "status": "failed",
                    "message": response.get("error", "Unknown error occurred"),
                    "submitted_items": 0
                }
                
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to submit to government portal: {str(e)}",
                "submitted_items": 0
            }
    
    def _format_gov_report(self, high_risk_items: List[Dict], store_id: str) -> Dict:
        """
        Format data according to government portal specifications.
        
        Args:
            high_risk_items: List of high-risk products
            store_id: Store identifier
            
        Returns:
            Formatted report dictionary
        """
        total_emission = sum(item.get("total_emission", 0) for item in high_risk_items)
        
        report = {
            "report_type": "carbon_emissions_compliance",
            "store_id": store_id,
            "submission_date": datetime.now().isoformat(),
            "total_high_risk_items": len(high_risk_items),
            "total_emissions_kg_co2e": round(total_emission, 2),
            "items": []
        }
        
        # Format each high-risk item
        for item in high_risk_items:
            formatted_item = {
                "product_id": item.get("id", "N/A"),
                "product_name": item.get("product", ""),
                "category": item.get("category", ""),
                "production_source": item.get("source", "Unknown"),
                "units_sold": item.get("units", 0),
                "emission_per_unit_kg_co2e": round(item.get("emission_per_unit", 0), 2),
                "total_emission_kg_co2e": round(item.get("total_emission", 0), 2),
                "risk_level": item.get("risk_level", "Critical")
            }
            report["items"].append(formatted_item)
        
        return report
    
    def _send_to_gov_api(self, report: Dict) -> Dict:
        """
        Send formatted report to government API endpoint.
        
        Args:
            report: Formatted government report
            
        Returns:
            API response containing success status
        """
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": "Bearer YOUR_GOV_API_KEY"  # Set your API key here
            }
            
            # Uncomment for real API calls:
            # response = requests.post(
            #     f"{self.gov_api_url}/submit-emissions",
            #     json=report,
            #     headers=headers,
            #     timeout=10
            # )
            # return response.json()
            
            # For development/testing - simulate successful submission
            import uuid
            return {
                "success": True,
                "reference_id": f"GOV-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}",
                "message": "Report received by government portal"
            }
            
        except requests.exceptions.RequestException as e:
            return {
                "success": False,
                "error": f"API connection failed: {str(e)}"
            }
        except json.JSONDecodeError:
            return {
                "success": False,
                "error": "Invalid response from government portal"
            }
    
    def get_submission_history(self) -> List[Dict]:
        """
        Get history of submissions to government portal.
        
        Returns:
            List of submission records
        """
        return self.submission_log
    
    def generate_compliance_certificate(self, store_id: str) -> Dict:
        """
        Generate compliance certificate for government reporting.
        
        Args:
            store_id: Store identifier
            
        Returns:
            Certificate data
        """
        store_submissions = [log for log in self.submission_log if log.get("store_id") == store_id]
        
        total_submissions = len(store_submissions)
        successful_submissions = len([s for s in store_submissions if s.get("status") == "success"])
        
        return {
            "store_id": store_id,
            "certificate_issued": datetime.now().isoformat(),
            "total_submissions": total_submissions,
            "successful_submissions": successful_submissions,
            "compliance_status": "compliant" if total_submissions > 0 else "pending",
            "next_submission_due": "30 days from last submission"
        }
