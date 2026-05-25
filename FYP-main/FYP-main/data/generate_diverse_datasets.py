import pandas as pd
import random
import os

# Configuration
DATA_FOLDER = "data"
os.makedirs(DATA_FOLDER, exist_ok=True)

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

def create_dataset(filename, num_rows, scenario):
    data = []
    for i in range(1, num_rows + 1):
        category = random.choice(list(CATEGORIES.keys()))
        product = random.choice(CATEGORIES[category])
        source = random.choice(SOURCES)
        pid = f"P{i:04d}"

        if scenario == "high_impact":
            # high unit emission categories + high units
            high_emitters = ["Electronics", "Plastic", "Textile", "Dairy"]
            category = random.choice(high_emitters)
            product = random.choice(CATEGORIES[category])
            units = random.randint(200, 1000)
        elif scenario == "low_impact":
            # Lower units
            units = random.randint(1, 40)
        elif scenario == "edge_cases":
            # Some missing data or weird strings
            if random.random() < 0.2:
                category = "Unknown Category"
            if random.random() < 0.2:
                product = "???"
            units = random.choice(["100", "0", "-50", "abc", 5000]) # Mixed types & weird values
        else: # mixed
            units = random.randint(10, 500)

        data.append({
            "ProductID": pid,
            "Product": product,
            "Category": category,
            "Units_Sold": units,
            "ProductionSource": source
        })
    
    df = pd.DataFrame(data)
    file_path = os.path.join(DATA_FOLDER, filename)
    df.to_csv(file_path, index=False)
    print(f"Generated {num_rows} rows for {scenario} -> {file_path}")

if __name__ == "__main__":
    create_dataset("high_impact.csv", 100, "high_impact")
    create_dataset("low_impact.csv", 100, "low_impact")
    create_dataset("mixed_test.csv", 200, "mixed")
    create_dataset("edge_cases.csv", 50, "edge_cases")
