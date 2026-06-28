"""Pytest configuration for async tests."""
import os
import sys
import tempfile

# Set up the Python path so imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Set a temporary data directory for tests
os.environ["DASHAWS_DATA_DIR"] = tempfile.mkdtemp()
os.environ["PORT"] = "3457"  # Use different port for tests
