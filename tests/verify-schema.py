import json

try:
    with open('data/schemas/export-schema.json', 'r', encoding='utf-8') as f:
        schema = json.load(f)
    print("Schema JSON is valid JSON.")

    with open('data/examples/muestra-montes-de-maria.json', 'r', encoding='utf-8') as f:
        sample = json.load(f)
    print("Sample JSON is valid JSON.")

    # Validate structure manually
    assert sample['metadata']['appName'] == 'PAnA V2 AGUA'
    assert 'counts' in sample['metadata']
    assert 'data' in sample
    for coll in ['water_sources', 'pluviometers', 'rainfall_records', 'sites', 'parcels', 'crops', 'observations']:
        assert coll in sample['data'], f"Missing collection {coll}"
        assert isinstance(sample['data'][coll], list), f"{coll} is not a list"
        print(f"  - {coll}: {len(sample['data'][coll])} items")

    print("\nSUCCESS: Sample dataset conforms to structure and is ready for import!")
except Exception as e:
    print(f"Error: {e}")
    exit(1)
