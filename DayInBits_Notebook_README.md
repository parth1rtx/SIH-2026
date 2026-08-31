# DayInBits: AI-Based Electricity Theft Detection

DayInBits is an experimental machine-learning notebook for detecting **Katiya-style electricity theft** from smart-meter consumption patterns. It uses the Smart Meters in London dataset, creates synthetic electricity-theft scenarios, engineers household-level risk features, and trains an XGBoost classifier to distinguish normal households from simulated theft cases.

> **Project status:** research prototype for Smart India Hackathon. The reported results are based on synthetically generated theft labels and must not be interpreted as field-tested accuracy.

## Notebook

The main file is:

```text
dayinbits_week1_1.ipynb
```

The notebook contains 39 code cells covering dataset download, exploration, cleaning, theft simulation, feature engineering, model training, evaluation, and visualisation.

## What the notebook does

```mermaid
flowchart LR
    A[London smart-meter data] --> B[Clean half-hourly readings]
    B --> C[Aggregate daily consumption]
    C --> D[Create synthetic feeders]
    D --> E[Inject Katiya scenarios and normal noise]
    E --> F[Engineer household features]
    F --> G[Train XGBoost classifier]
    G --> H[Evaluate predictions and plot results]
```

### 1. Downloads and explores the dataset

The notebook downloads the [Smart Meters in London dataset](https://www.kaggle.com/datasets/jeanmidev/smart-meters-in-london) using the Kaggle CLI and extracts it into `smart_meters_data/`.

It reads:

- `informations_households.csv` for household metadata.
- `block_0.csv`, `block_1.csv`, and `block_2.csv` from the half-hourly dataset.

These three blocks contain 150 unique households. The notebook initially finds 141 households with more than 20,000 readings and selects up to 100 for the experiment.

### 2. Cleans the smart-meter readings

The cleaning function:

- Converts timestamps to datetime values.
- Converts energy readings to numeric values.
- Removes missing and negative readings.
- Removes values above the 99.9th percentile.
- Removes duplicate records.
- Keeps households with more than 20,000 readings.

After cleaning, the notebook works with approximately 2.88 million half-hour readings.

### 3. Creates daily household consumption

Half-hourly readings are multiplied by `0.4` as an experimental scale adjustment and then summed by household and date to create `daily_kwh`.

The notebook groups households into synthetic feeders, normally with five households per feeder. It also demonstrates a 12-day theft event by comparing simulated transformer consumption with the total reported by household meters.

### 4. Generates synthetic Katiya cases

Using `random_state`/seed 42, the notebook randomly selects 20 households as synthetic Katiya cases.

The final simulation applies:

- A consistent theft rate of 60% to 95% for each selected household.
- Partial metering instead of forcing every theft reading to zero.
- Zero readings on approximately 2% of normal-household days to represent outages or meter errors.

The final experimental dataset contains 99 households:

- 79 normal households.
- 20 synthetic Katiya households.

### 5. Engineers model features

The final model uses seven household-level features:

| Feature | Description |
| --- | --- |
| `avg_metered` | Mean daily metered consumption |
| `std_metered` | Variation in daily metered consumption |
| `max_metered` | Maximum daily metered consumption |
| `min_metered` | Minimum daily metered consumption |
| `avg_actual` | Mean simulated consumption before theft is applied |
| `theft_ratio` | Estimated fraction of consumption that was not metered |
| `zero_day_ratio` | Fraction of days with a zero meter reading |

The theft ratio is calculated as:

```text
theft_ratio = 1 - (avg_metered / avg_actual)
```

### 6. Trains the final model

The final classifier is an `XGBClassifier` configured with:

```python
XGBClassifier(
    n_estimators=200,
    max_depth=4,
    learning_rate=0.1,
    random_state=42
)
```

The data is split into 70% training and 30% testing sets using a stratified split.

## Saved notebook results

The final test set contains 30 households: 24 normal households and 6 synthetic theft cases.

| Metric | Saved result |
| --- | ---: |
| Accuracy | 96.7% |
| Theft precision | 100% |
| Theft recall | 83% |
| Theft F1-score | 91% |
| False positives | 0 |
| False negatives | 1 |

The notebook also produces:

- A one-week household-consumption plot.
- A transformer-versus-meter gap plot.
- Confusion matrices.
- XGBoost feature-importance plots.
- A theft-ratio distribution comparing normal and synthetic Katiya households.

## Requirements

The notebook was executed in Google Colab with Python 3.12 in the saved run. It uses:

```text
pandas
numpy
matplotlib
seaborn
scikit-learn
xgboost
kaggle
```

## Running the notebook in Google Colab

1. Upload `dayinbits_week1_1.ipynb` to Google Colab.
2. Configure Kaggle API authentication in Colab. Never commit Kaggle credentials to GitHub.
3. Run the installation and dataset-download cells.
4. Allow the dataset to extract into `smart_meters_data/`.
5. Run the remaining cells in order.

The notebook currently reads a Colab secret named `kaggleAPIkey`. Depending on your Kaggle CLI configuration, you may also need the standard Kaggle username/key environment variables or a `kaggle.json` credentials file.

## Repository structure

```text
.
├── dayinbits_week1_1.ipynb    # Complete experiment
└── README.md                   # Project documentation
```

The downloaded dataset should remain outside Git version control because of its size and source licence.

## Important limitations

This notebook demonstrates a synthetic proof of concept. It does not yet prove that the model will detect electricity theft in a real Indian distribution network.

- All theft labels are generated artificially; the dataset contains no verified theft cases.
- `avg_actual` is taken from untampered consumption before synthetic theft is applied. A bypassed household meter normally cannot provide this value directly.
- `theft_ratio` therefore gives the classifier a strong signal that may be unavailable during deployment.
- The final evaluation uses only 30 test households.
- London household behaviour may differ from Indian consumption, tariff, climate, appliance, and outage patterns.
- Multiplying consumption by `0.4` changes its magnitude but does not reproduce Indian usage behaviour.
- Filling missing daily readings with zero can confuse missing data with genuine zero consumption.
- Weather, holidays, ACORN groups, and tariff information are available in the dataset but are not used by the current model.
- The model assigns a household-level label over its full history; it does not identify the start date of a theft event.
- `theft_scenario.pkl` is created before the final `model_v3` experiment and contains the earlier baseline model, not the final 200-tree classifier.

## Recommended next steps

- Replace `avg_actual` with a deployable expected-consumption baseline or feeder/transformer reconciliation signal.
- Train on rolling time windows so the system can detect when suspicious behaviour starts.
- Add weather, holidays, tariff type, outages, and seasonal behaviour as contextual features.
- Distinguish missing readings, technical losses, vacant homes, outages, and meter faults from suspected theft.
- Validate the approach with utility-provided, investigation-confirmed cases.
- Export the final feature pipeline and `model_v3` together for reproducible inference.
- Report precision, recall, false-positive rate, and inspection outcomes instead of relying only on accuracy.

## Responsible use

The model should rank cases for human investigation. Its predictions should not be treated as proof of theft or used automatically for penalties, disconnection, or legal action.

## Data licence

The saved Kaggle output identifies the Smart Meters in London dataset licence as **ODbL 1.0**. Follow the dataset page and licence requirements when redistributing data or derived databases. Add a separate software licence to this repository if you want others to reuse the notebook code.

