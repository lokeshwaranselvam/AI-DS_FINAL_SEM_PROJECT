"""
CarbonLens — recommender.py  v2.0
Generates LLM-style narrative recommendations for high-emission products.
"""

import random


class CarbonRecommender:
    def __init__(self):
        # Database: category → product keyword → (alternative name, est_emission_factor, rationale_template)
        self.alternatives_db = {
            "Dairy": {
                "Milk":    ("Oat Milk",              0.38, "oat-based production uses significantly less water and land, and produces far fewer greenhouse gases per litre compared to conventional dairy"),
                "Cheese":  ("Nut-based Cheese",      0.42, "cashew and almond-based cheese alternatives eliminate the methane-intensive cattle farming component that drives most of conventional cheese's carbon cost"),
                "Yogurt":  ("Coconut Yogurt",         0.35, "coconut-based yogurt avoids the methane emissions of ruminant livestock and requires minimal refrigeration during transport compared to chilled dairy"),
                "Butter":  ("Olive Oil Spread",       0.30, "plant-based spreads derived from olive or sunflower oils have a fraction of the emission intensity of dairy butter, which carries a high burden from cow methane and land use"),
                "Cream":   ("Oat Cream",              0.36, "oat-based cream alternatives have demonstrated up to 70% lower lifecycle emissions and are increasingly available at competitive price points from local suppliers"),
                "default": ("Plant-based Dairy Alternative", 0.40, "plant-derived dairy substitutes consistently show 60–80% lower carbon footprints across their full supply chains compared to animal-based equivalents"),
            },
            "Plastic": {
                "Bottle":   ("Reusable Glass/Metal Bottle", 0.20, "while glass and metal require more energy to produce initially, their reuse potential across hundreds of cycles dramatically lowers the per-use emission footprint"),
                "Bag":      ("Cotton Tote Bag",             0.15, "organic cotton tote bags, when reused more than 50 times, achieve a significantly lower per-use emission than single-use plastic, which also risks non-biodegradable land waste"),
                "Packaging":("Mushroom Packaging (Ecovative)", 0.10, "mycelium-based packaging is compostable within weeks, requires no fossil fuels during growth, and sequesters carbon during its biological lifecycle"),
                "Cutlery":  ("Bamboo Cutlery Set",          0.12, "bamboo is one of the fastest-regenerating plant materials on Earth and produces cutlery with a lifecycle emission roughly 85% lower than petroleum-derived plastic alternatives"),
                "Straw":    ("Paper or Bamboo Straw",       0.08, "natural fibre straws decompose within months and are now competitively priced, removing the persistent microplastic pollution risk entirely"),
                "default":  ("Biodegradable or Reusable Alternative", 0.18, "replacing single-use plastic items with biodegradable or reusable alternatives directly reduces scope 3 emissions from waste management and raw material extraction"),
            },
            "Electronics": {
                "Phone":   ("Fairphone / Refurbished Handset", 0.45, "refurbished smartphones avoid the mineral extraction and manufacturing emissions of new devices — the production phase accounts for over 80% of a phone's total lifetime footprint"),
                "Laptop":  ("Repairable Laptop (Framework/refurb)", 0.90, "modular, repairable laptops extend product life by 3–5 years and reduce the frequency of full-device replacement, cutting associated manufacturing emissions proportionally"),
                "Monitor": ("Energy-Efficient LED Monitor",  0.60, "LED monitors with automatic brightness adaptation and sleep-mode compliance reduce operational electricity draw by 40–60% compared to older LCD or fluorescent backlit panels"),
                "default": ("Energy Star Certified or Refurbished Device", 0.70, "choosing certified energy-efficient or refurbished electronics is the single most impactful step for reducing scope 3 electronics emissions in retail environments"),
            },
            "Food": {
                "Beef":           ("Plant-based Meat / Red Lentils", 0.45, "beef production generates 20–30 kg CO₂e per kilogram of product — plant-based equivalents average under 3 kg CO₂e, representing a reduction of over 85% without meaningful nutritional trade-offs"),
                "Lamb":           ("Chicken / Tofu",                 0.60, "lamb has the second-highest emission intensity of any common protein, largely due to methane from ruminant digestion — poultry and legume proteins provide equivalent nutrition at a fraction of the climate cost"),
                "Pork":           ("Seitan / Chickpea-based Protein",0.48, "wheat-based and legume proteins require dramatically less water, land, and feed energy than pork production, with lifecycle emissions typically 70–75% lower"),
                "Chicken":        ("Beans / Lentils / Legumes",      0.30, "while chicken is the lowest-emission conventional meat, switching even partially to legumes further reduces per-serving emissions and supports local agricultural sourcing in many regions"),
                "Processed Food": ("Whole Foods / Local Produce",    0.35, "ultra-processed foods carry embedded emissions from extended manufacturing chains, multi-stage packaging, and long-haul distribution — local whole foods compress this supply chain substantially"),
                "default":        ("Locally Sourced or Plant-Forward Alternative", 0.40, "transitioning toward locally sourced and minimally processed food products is one of the highest-impact changes a retailer can make to its overall scope 3 emission profile"),
            },
            "Textile": {
                "Polyester":           ("Recycled Polyester (rPET)", 0.55, "recycled polyester derived from post-consumer plastic bottles uses 59% less energy than virgin polyester production and diverts plastic waste from landfill and ocean systems"),
                "Nylon":              ("Econyl (regenerated nylon)", 0.48, "Econyl uses nylon waste — including fishing nets and carpet fibres — as its raw material, achieving roughly 80% lower global warming potential than conventional nylon manufacturing"),
                "Conventional Cotton": ("Organic or BCI Cotton",    0.60, "organic cotton eliminates synthetic pesticide and fertiliser production emissions and typically uses less water through rain-fed growing practices, reducing lifecycle impact by 30–46%"),
                "Rayon":              ("Tencel / Lyocell",           0.42, "Tencel is produced in a closed-loop solvent system that recaptures 99% of chemicals used, with FSC-certified wood sources ensuring sustainable feedstock with minimal deforestation risk"),
                "default":            ("Certified Sustainable Fabric Alternative", 0.50, "selecting textiles certified under GOTS, Bluesign, or Cradle to Cradle standards ensures lower chemical use, ethical production chains, and verified emission reductions"),
            },
            "Transport": {
                "Flight": ("Rail or Videoconference",      0.20, "short-haul flights produce 10–15× the CO₂e per passenger kilometre compared to equivalent rail journeys — shifting even 30% of business travel to rail yields significant scope 1 and 2 reductions"),
                "Car":    ("EV / Public Transit / Carpool",0.18, "battery-electric vehicles charged on renewable grids produce 60–70% fewer lifecycle emissions than petrol equivalents; public transit and carpooling further compress per-passenger emission intensity"),
                "default":("Sustainable Transport Mode",  0.25, "transport optimisation — including route consolidation, electric vehicle adoption, and multi-drop delivery scheduling — typically yields 25–40% last-mile emission reductions within 12 months"),
            },
            "Packaging": {
                "Styrofoam":    ("Mycelium Packaging (Ecovative)", 0.12, "EPS Styrofoam takes over 500 years to decompose and is rarely recyclable — mycelium alternatives biodegrade in under 30 days and are now cost-competitive for most food and retail packaging applications"),
                "Plastic Wrap": ("Beeswax Wrap / Silicone Covers", 0.10, "reusable beeswax and silicone covers eliminate the daily single-use plastic waste stream from food storage, reducing per-use packaging emissions by over 90% when reused across a typical product lifetime"),
                "default":      ("Minimal or Compostable Packaging", 0.15, "right-sizing packaging to reduce material volume and switching to compostable or home-recyclable materials are the most accessible and commercially viable emission-reduction levers in retail packaging"),
            },
        }

        # Narrative sentence pools for variation
        self.context_openers = [
            "Our analysis of your current product mix indicates that",
            "Based on lifecycle emission data for your uploaded dataset,",
            "CarbonLens AI has identified that",
            "Supply chain modelling for this product category shows that",
            "Emission profiling across comparable UK and EU retailers reveals that",
        ]

        self.action_phrases = [
            "We recommend transitioning this SKU to",
            "The highest-impact substitution for this product is",
            "Your procurement team should evaluate replacing this item with",
            "A direct like-for-like swap to",
            "Introducing",
        ]

        self.closing_phrases = [
            "This change alone could contribute to measurable progress toward your store's net-zero targets.",
            "Early adopters of this substitution in comparable retail segments have reported strong consumer acceptance.",
            "This recommendation has been validated against current wholesale pricing and supplier availability in your region.",
            "The transition can be phased across two procurement cycles to manage supplier relationships and stock clearance.",
            "We estimate payback on any switching costs within one to two quarters given current carbon pricing trajectories.",
        ]

        self.confidence_levels = ["High", "High", "Medium-High", "Medium"]

    def get_suggestions(self, product_emissions):
        """
        Generates LLM-style narrative suggestions for high-emission products.

        Args:
            product_emissions (list): List of dicts with 'product', 'category', 'emission_per_unit'.

        Returns:
            list: List of suggestion dicts with narrative text.
        """
        if not product_emissions:
            return []

        suggestions = []

        for item in product_emissions:
            product = item.get("product", "Unknown Product")
            category = item.get("category", "General")
            current_emission = float(item.get("emission_per_unit", 1.0))

            alt_name, alt_emission, rationale = self._find_alternative(category, product)

            reduction_potential = round(max(current_emission - alt_emission, 0), 2)
            reduction_pct = round((reduction_potential / current_emission) * 100) if current_emission > 0 else 0

            # Risk analysis
            if reduction_pct < 10:
                risk_analysis = "Moderate — Minimal Reduction Expected"
                risk_class = "mod"
            elif current_emission > 5.0:
                risk_analysis = "High Priority — Immediate Action Recommended"
                risk_class = "high"
            else:
                risk_analysis = "Low Risk — Standard Procurement Cycle"
                risk_class = "low"

            # Generate LLM-style narrative paragraph
            narrative = self._build_narrative(
                product, category, alt_name, rationale,
                current_emission, alt_emission, reduction_pct
            )

            confidence = random.choice(self.confidence_levels)

            suggestions.append({
                "original_product":     product,
                "category":             category,
                "alternative_product":  alt_name,
                "reduction_potential":  reduction_potential,
                "reduction_pct":        reduction_pct,
                "risk_analysis":        risk_analysis,
                "narrative":            narrative,
                "confidence":           confidence,
            })

        return suggestions

    def _build_narrative(self, product, category, alt_name, rationale, current, alt, pct):
        """Build a multi-sentence, LLM-style recommendation paragraph."""
        opener = random.choice(self.context_openers)
        action = random.choice(self.action_phrases)
        closing = random.choice(self.closing_phrases)

        paragraph = (
            f"{opener} <strong>{product}</strong> carries an emission intensity of "
            f"<strong>{current:.2f} kg CO₂e per unit</strong>, placing it in the elevated-impact tier "
            f"for the {category} category. "
            f"This is primarily because {rationale}. "
            f"{action} <strong>{alt_name}</strong>, which is estimated at "
            f"<strong>{alt:.2f} kg CO₂e per unit</strong> — a projected reduction of "
            f"<strong>{pct}%</strong> on a like-for-like basis. "
            f"{closing}"
        )
        return paragraph

    def _find_alternative(self, category, product):
        """Look up the best-matching alternative and return (name, emission_factor, rationale)."""
        cat_key = None
        for key in self.alternatives_db:
            if key.lower() in category.lower():
                cat_key = key
                break

        if not cat_key:
            return ("Generic Eco-Friendly Alternative", 0.50,
                    "this product category has established lower-emission substitutes that are widely available through certified sustainable supply channels")

        category_dict = self.alternatives_db[cat_key]

        # Try to match a product keyword
        for key, value in category_dict.items():
            if key == "default":
                continue
            if key.lower() in product.lower():
                return value  # (name, factor, rationale)

        # Fall back to default for this category
        return category_dict["default"]