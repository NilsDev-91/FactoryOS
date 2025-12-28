
import requests

url = "http://localhost:8000/api/printers/SIM-001" 

try:
    print(f"Sending DELETE to {url}...")
    response = requests.delete(url)
    print(f"Status Code: {response.status_code}")
    print("Response Body:")
    print(response.text)
except Exception as e:
    print(f"Request failed: {e}")
