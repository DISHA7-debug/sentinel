# MODEL 5 — Federated Fleet Learning
**Owner: ML Engineer 3 (same as Model 3)**
**Depends on: Model 3 (Risk Scoring) being trained first**

---

## What This Model Does

Allows each Tata vehicle in the fleet to improve the risk scoring model (Model 3) from its own on-road experience — **without sending raw sensor data to any server**.

Only **gradient updates** (tiny compressed files) are shared. The central server aggregates them using **FedAvg** and distributes an improved global model back to all vehicles.

For the hackathon: simulate 3–5 "vehicles" on your laptops, each fine-tuning locally, then aggregate.

---

## Why This Is a Big Deal for Tata

- **Privacy:** No video/sensor data ever leaves the vehicle — critical for user acceptance
- **Scale:** 100K+ Tata vehicles continuously improving the model = impossible with centralized training
- **India adaptation:** A fleet driving Mumbai roads improves the model for Mumbai; Delhi roads for Delhi

---

## Architecture (Flower Framework)

```
Vehicle 1 (Flower Client) ──┐
Vehicle 2 (Flower Client) ──┤ → FedAvg Aggregation → Global Model → All Vehicles
Vehicle 3 (Flower Client) ──┘
         ↑ Local fine-tuning on new road experiences only
         ↑ Only gradient deltas uploaded (~100KB per round)
```

---

## Setup

```bash
pip install flwr torch numpy
```

---

## Server (runs in backend / central server)

```python
# fl_server.py
import flwr as fl
import numpy as np

class SentinelFLServer(fl.server.strategy.FedAvg):
    def __init__(self, min_clients=2, rounds=10):
        super().__init__(
            min_fit_clients=min_clients,
            min_evaluate_clients=min_clients,
            min_available_clients=min_clients,
        )
        self.rounds = rounds

    def aggregate_fit(self, server_round, results, failures):
        """Standard FedAvg aggregation of model weights."""
        aggregated = super().aggregate_fit(server_round, results, failures)
        if aggregated:
            weights, metrics = aggregated
            # Save updated global model after each round
            self._save_global_model(weights, server_round)
        return aggregated

    def _save_global_model(self, weights, round_num):
        import flwr as fl
        import torch
        from model3_risk import RiskScoringLSTM

        model = RiskScoringLSTM()
        params_dict = zip(model.state_dict().keys(), fl.common.parameters_to_ndarrays(weights))
        state_dict = {k: torch.tensor(v) for k, v in params_dict}
        model.load_state_dict(state_dict)

        torch.save(model.state_dict(), f"models/weights/model3_global_r{round_num}.pth")

        # Export to ONNX for deployment
        dummy = torch.randn(1, 5, 542)
        torch.onnx.export(model, dummy, "models/weights/model3_risk.onnx",
                          input_names=["sequence"], output_names=["risk_score"], opset_version=17)
        print(f"✅ Round {round_num}: Global model saved and exported")

def start_fl_server(port=8080, rounds=10):
    strategy = SentinelFLServer(min_clients=2, rounds=rounds)
    fl.server.start_server(
        server_address=f"0.0.0.0:{port}",
        config=fl.server.ServerConfig(num_rounds=rounds),
        strategy=strategy,
    )

if __name__ == "__main__":
    start_fl_server()
```

---

## Client (runs on each vehicle / simulated vehicle)

```python
# fl_client.py
import flwr as fl
import torch
import torch.nn as nn
import numpy as np
from model3_risk import RiskScoringLSTM

class SentinelVehicleClient(fl.client.NumPyClient):
    def __init__(self, vehicle_id: str, local_data_path: str):
        self.vehicle_id = vehicle_id
        self.model = RiskScoringLSTM()
        self.criterion = nn.BCELoss()
        self.optimizer = torch.optim.Adam(self.model.parameters(), lr=5e-4)
        self.local_data = self._load_local_data(local_data_path)

    def get_parameters(self, config):
        """Return current model weights to server."""
        return [val.cpu().numpy() for val in self.model.state_dict().values()]

    def set_parameters(self, parameters):
        """Receive and load global model weights from server."""
        params_dict = zip(self.model.state_dict().keys(), parameters)
        state_dict = {k: torch.tensor(v) for k, v in params_dict}
        self.model.load_state_dict(state_dict)

    def fit(self, parameters, config):
        """Local training on this vehicle's data."""
        self.set_parameters(parameters)
        self.model.train()

        # Train for 3 local epochs on recent on-road data
        X, y = self.local_data
        dataset = torch.utils.data.TensorDataset(
            torch.tensor(X, dtype=torch.float32),
            torch.tensor(y, dtype=torch.float32)
        )
        loader = torch.utils.data.DataLoader(dataset, batch_size=32, shuffle=True)

        for _ in range(3):  # local epochs
            for X_batch, y_batch in loader:
                self.optimizer.zero_grad()
                pred = self.model(X_batch)
                loss = self.criterion(pred, y_batch)
                loss.backward()
                self.optimizer.step()

        print(f"Vehicle {self.vehicle_id}: local training done")
        return self.get_parameters({}), len(dataset), {}

    def evaluate(self, parameters, config):
        """Evaluate global model on local validation data."""
        self.set_parameters(parameters)
        self.model.eval()
        X, y = self.local_data
        with torch.no_grad():
            pred = self.model(torch.tensor(X, dtype=torch.float32))
            loss = self.criterion(pred, torch.tensor(y, dtype=torch.float32))
        return float(loss), len(X), {"loss": float(loss)}

    def _load_local_data(self, path):
        """Load this vehicle's recent driving data (last 1000 frames)."""
        data = np.load(path)
        return data["X"], data["y"]


def start_vehicle_client(vehicle_id: str, data_path: str, server_address: str = "localhost:8080"):
    client = SentinelVehicleClient(vehicle_id, data_path)
    fl.client.start_numpy_client(server_address=server_address, client=client)


if __name__ == "__main__":
    import sys
    vehicle_id = sys.argv[1] if len(sys.argv) > 1 else "vehicle_001"
    data_path   = sys.argv[2] if len(sys.argv) > 2 else f"data/{vehicle_id}_driving.npz"
    start_vehicle_client(vehicle_id, data_path)
```

---

## Synthetic Data Generator (for demo)

```python
# generate_demo_fl_data.py
# Creates fake driving data for 3 simulated vehicles

import numpy as np, os

os.makedirs("data", exist_ok=True)

for vehicle_id in ["vehicle_001", "vehicle_002", "vehicle_003"]:
    N = 500  # 500 driving sequences per vehicle
    X = np.random.randn(N, 5, 542).astype(np.float32)

    # Inject vehicle-specific patterns (simulates different city driving)
    if vehicle_id == "vehicle_001":   # Mumbai — lots of auto-rickshaws
        X[:, :, 6] = np.random.uniform(0.6, 1.0, (N, 5))  # high auto_rickshaw class idx
    elif vehicle_id == "vehicle_002": # Rajasthan — cattle
        X[:, :, 7] = np.random.uniform(0.5, 0.9, (N, 5))  # high cattle
    elif vehicle_id == "vehicle_003": # Delhi highway — trucks
        X[:, :, 1] = np.random.uniform(0.7, 1.0, (N, 5))  # high truck

    y = np.clip(np.random.beta(1.5, 4.0, N).astype(np.float32), 0, 1)

    np.savez(f"data/{vehicle_id}_driving.npz", X=X, y=y)
    print(f"Generated data for {vehicle_id}")
```

---

## Hackathon Demo Script for FL

```bash
# Terminal 1: Start FL server
python fl_server.py

# Terminal 2: Vehicle 1 (Mumbai)
python fl_client.py vehicle_001 data/vehicle_001_driving.npz

# Terminal 3: Vehicle 2 (Rajasthan)
python fl_client.py vehicle_002 data/vehicle_002_driving.npz

# Terminal 4: Vehicle 3 (Delhi)
python fl_client.py vehicle_003 data/vehicle_003_driving.npz

# Watch the console: each round shows gradient aggregation
# After 10 rounds: model3_risk.onnx is updated globally
```

---

## Backend Integration

The backend already has `/api/fleet/upload-gradients` and `/api/fleet/global-model/{name}` endpoints.

For the hackathon, the FL server runs as a separate process. In production it would be part of the backend service.

---

## What to Deliver

1. `fl_server.py` — working FL aggregation server
2. `fl_client.py` — vehicle client implementation
3. `generate_demo_fl_data.py` — synthetic data for demo
4. A 30-second demo showing 3 terminal windows running FL rounds → model improves
5. Final `model3_risk.onnx` after FL convergence → hand to backend lead
