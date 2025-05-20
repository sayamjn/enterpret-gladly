Gladly Integration for Enterpret

This project implements a CLI tool that imports conversation data from Gladly into Enterpret's Customer Feedback Analytics System. The integration supports incremental imports, pulling only new or updated conversation data since the last successful import.

## Table of Contents

* Understanding Gladly
* Solution Architecture
* Setup and Configuration
* Usage
* Data Transformation
* Error Handling
* Monitoring and Logging
* Assumptions & Limitations
* Future Enhancements

## Understanding Gladly

Gladly is a customer service platform that organizes customer interactions into conversations rather than tickets. Key concepts include:

### Core Entities

* **Customers:** Profiles with contact information and attributes
* **Conversations:** Timeline of interactions with metadata (status, assignee, topics)
* **Conversation Items:** Actual messages (emails, chat, SMS, phone calls, etc.)
* **Agents:** Service representatives interacting with customers
* **Topics:** Tags that categorize conversations

### API Authentication

Gladly uses token-based Basic Authentication. The integration requires providing credentials via environment variables or a config file, but no live credentials are included here.

## Solution Architecture

The integration follows a modular architecture:

```
Gladly API → CLI Importer → Enterpret API
                      ↓
                  State Manager
```

### Components

* **Config Manager:** Merges environment and file-based settings
* **State Manager:** Tracks last successful import timestamp in a local file
* **GladlyClient:** Authenticates & fetches data with pagination and retry handling
* **Transformer:** Converts Gladly's JSON into Enterpret's schema
* **EnterpretClient:** Posts transformed data to Enterpret in batches
* **Logger:** Outputs console and file logs for operations
* **CLI (Commander.js):** Parses flags for full/incremental runs and date filters

## Setup and Configuration

### Prerequisites

* Node.js 14.x or higher
* No actual Gladly credentials are shipped—provide your own via config

### Installation

```bash
# Clone the repository
git clone https://github.com/sayamjn/enterpret-gladly.git
cd enterpret-gladly

# Install dependencies
npm install

# Configure environment\cp .env.example .env
# Edit .env with your own API credentials
```

### Configuration Options

Create a `.env` or JSON config with:

```bash
# Gladly API (no live tokens included here)
GLADLY_API_URL=https://{your-org}.gladly.com
GLADLY_USERNAME=<your-email>
GLADLY_API_TOKEN=<your-token>

# Enterpret API
ENTERPRET_API_URL=https://api.enterpret.com
ENTERPRET_API_KEY=<your-enterpret-key>

# Import settings
BATCH_SIZE=100
MAX_RETRIES=3
RETRY_DELAY=5000
STATE_FILE_PATH=./data/import-state.json
LOG_LEVEL=info
```

## Usage

Basic commands:

```bash
# Full import
npm run import -- --full

# Incremental (default)
npm run import

# Custom date range
npm run import -- --start-date="2023-01-01T00:00:00Z" --end-date="2023-06-01T00:00:00Z"
```

Flags:

* `--full` : ignore previous state, import all
* `--incremental` : import since last run (default)
* `--start-date`, `--end-date` : ISO dates
* `--limit` : max conversations
* `--verbose` : debug logs

## Data Transformation

### Mapping Overview

| Gladly Entity        | Enterpret Entity | Notes                    |
| -------------------- | ---------------- | ------------------------ |
| Conversation + Items | Feedback Record  | Combined into one record |
| Customer             | Customer         | Basic profile info       |
| Topics               | Tags             | Mapped directly          |
| Agent                | Agent            | ID and optional name     |


## Error Handling

* **Rate Limiting:** Retries with backoff on 429
* **Network Failures:** Configurable retries and delays
* **Data Validation:** Throws on missing required fields
* **Partial Failures:** Continues other records, logs errors
* **State Safe:** State file only updated on full success

## Monitoring and Logging

* Timestamped logs for each operation
* Console (colored) and file transports (`logs/`)
* Rotate and size-based file logs

## Assumptions & Limitations

* **No Live Testing:** Implementation covers HTTP calls with axios but does not execute without valid credentials or sandbox.
* **In-Memory Storage:** Transformed data is held in memory; no DB persistence by design.
* **Credential Pluggable:** Accepts env or config file, but real tokens must be provided externally.
* **Endpoint Discovery:** Exact Gladly endpoints inferred from docs; may need adjustment if Gladly API changes.
* **Batch Defaults:** Default batch size is 100; large exports might require adjusting or using Gladly export jobs directly.
* **No Schema Enforcement:** Enterpret schema mapping is based on assumptions; validate with Enterpret team if stricter shapes needed.
* **Mock Tests Recommended:** Without live credentials, use HTTP mocks (nock or similar) for unit tests.

## Future Enhancements

* Webhook support for real-time imports
* Configurable field mappings
* Pluggable persistence layers (DB, S3)
* Advanced topic and metadata handling
* Integration with observability tools (Prometheus, Datadog)
