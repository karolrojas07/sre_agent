from fastapi.testclient import TestClient
from main import app
import pytest
from unittest.mock import patch, AsyncMock

client = TestClient(app)

def test_report_incident_endpoint_exists():
    # This will fail (Red) until we implement the endpoint
    response = client.post("/report-incident", json={"incident_details": "Test incident"})
    assert response.status_code == 202
    assert "task_id" in response.json()

@patch("main.publish_task", new_callable=AsyncMock)
def test_report_incident_triggers_background_task(mock_publish):
    response = client.post("/report-incident", json={"incident_details": "Critical failure"})
    assert response.status_code == 202
    mock_publish.assert_called_once()
    # Check if task_id was passed
    args, kwargs = mock_publish.call_args
    assert len(args[0]) == 36 # UUID length
    assert args[1] == "Critical failure"
