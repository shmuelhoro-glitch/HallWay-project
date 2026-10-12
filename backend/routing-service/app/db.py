import os

from dotenv import load_dotenv
from pymongo import MongoClient

# Reads .env on your computer. On Render the variables come from the dashboard.
load_dotenv()

# The same database as the main server. MongoClient connects only on the first query.
client = MongoClient(os.environ["MONGO_URI"])
db = client["in-routing"]
