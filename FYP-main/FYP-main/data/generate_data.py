import pandas as pd
import random

# Configuration
NUM_ROWS = 500
OUTPUT_FILE = "data/sample.csv"

CATEGORIES = {
    "Dairy": ["Milk", "Cheese", "Yogurt", "Butter", "Ice Cream"],
    "Plastic": ["Bottle", "Bag", "Packaging", "Cutlery", "Straws", "Containers"],
    "Electronics": ["Phone", "Laptop", "Monitor", "Tablet", "Headphones", "Battery"],
    "Food": ["Beef", "Lamb", "Pork", "Chicken", "Rice", "Wheat", "Processed Food"],
    "Textile": ["T-Shirt", "Jeans", "Dress", "Skirt", "Jacket", "Polyester Fabric"],
    "Transport": ["Flight", "Car Travel", "Truck Delivery"],
    "Packaging": ["Styrofoam", "Plastic Wrap", "Cardboard Box"]
}

SOURCES = ["Local Farm", "Factory A", "Factory B", "Imported (China)", "Imported (USA)", "Local Manufacturer"]

def generate_data():
    data = []
    
    for i in range(1, NUM_ROWS + 1):
        category = random.choice(list(CATEGORIES.keys()))
        product = random.choice(CATEGORIES[category])
        
        # Weighted random for units (some low, some very high)
        units = random.choices([
            random.randint(10, 50),   # Low
            random.randint(51, 200),  # Medium
            random.randint(201, 1000) # High
        ], weights=[0.4, 0.4, 0.2])[0]
        
        source = random.choice(SOURCES)
        
        pid = f"P{i:04d}"
        
        data.append({
            "ProductID": pid,
            "Product": product,
            "Category": category,
            "Units_Sold": units,
            "ProductionSource": source
        })
        
    df = pd.DataFrame(data)
    df.to_csv(OUTPUT_FILE, index=False)
    print(f"Generated {NUM_ROWS} rows of data to {OUTPUT_FILE}")

if __name__ == "__main__":
    generate_data()
