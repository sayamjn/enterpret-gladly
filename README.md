Gladly Integration for Enterpret

This project implements a CLI tool that imports conversation data from Gladly into Enterpret's Customer Feedback Analytics System. The integration supports incremental imports, pulling only new or updated conversation data since the last successful import.

Table of Contents

Understanding Gladly
Solution Architecture
Setup and Configuration
Usage
Data Transformation
Error Handling
Monitoring and Logging
Future Enhancements

Understanding Gladly

Gladly is a customer service platform that organizes customer interactions into conversations rather than tickets. Key concepts include:

Core Entities

Customers: Profiles with contact information and attributes
Conversations: Timeline of interactions with metadata (status, assignee, topics)
Conversation Items: Actual messages (emails, chat, SMS, phone calls, etc.)
Agents: Service representatives interacting with customers
Topics: Tags that categorize conversations

API Authentication

Gladly uses token-based Basic Authentication. The integration requires:

A Gladly account with API User permissions
An API token generated from the Gladly dashboard
Configuration of credentials as environment variables or in a config file

Solution Architecture

The integration follows a modular architecture with these key components:

High-Level Design
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│                 │      │                 │      │                 │
│  Gladly API     │─────▶│  CLI Importer   │─────▶│  Enterpret      │
│                 │      │                 │      │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                 │
                                 │
                          ┌──────▼──────┐
                          │             │
                          │  State DB   │
                          │             │
                          └─────────────┘


Components

Config Manager: Handles API credentials and integration settings
State Manager: Tracks the last successful import timestamp
API Client: Handles authentication and communication with Gladly API
Fetcher: Retrieves data from Gladly with pagination support
Transformer: Converts Gladly's data format to Enterpret's schema
Persister: Saves transformed data and updates state
Logger: Provides detailed logging for monitoring and debugging

Setup and Configuration

Prerequisites

Node.js 14.x or higher
Access to Gladly API (with credentials)
Write access to Enterpret

Installation

# Clone the repository
git clone https://github.com/yourusername/gladly-enterpret-integration.git
cd gladly-enterpret-integration

# Install dependencies
npm install

# Setup configuration
cp .env.example .env
# Edit .env with your credentials


Configuration Options
Create a .env file with the following variables:

# Gladly API Configuration
GLADLY_API_URL=https://{your-org}.gladly.com
GLADLY_USERNAME=your-api-user@example.com
GLADLY_API_TOKEN=your-api-token

# Enterpret Configuration
ENTERPRET_API_URL=https://api.enterpret.com
ENTERPRET_API_KEY=your-enterpret-api-key

# Import Configuration
BATCH_SIZE=100
MAX_RETRIES=3
RETRY_DELAY=5000


Usage

Basic Import Command

# Run a full import
npm run import

# Run an incremental import (default)
npm run import -- --incremental

# Specify a custom start date
npm run import -- --start-date="2023-01-01T00:00:00Z"


Options

--incremental: Only import new data since last successful import (default)
--full: Perform a full import regardless of last import state
--start-date: Override the start date for the import (ISO 8601 format)
--end-date: Set an end date for the import (ISO 8601 format)
--limit: Maximum number of conversations to import
--verbose: Enable detailed logging

Data Transformation

The integration transforms Gladly's data model into Enterpret's schema:

Gladly to Enterpret Mapping

Gladly Entity	Enterpret Entity	Notes
Conversation + Items	Feedback Record	Combined into a single feedback record
Customer	Customer	Basic profile information
Topics	Tags	Mapped to Enterpret tags
Agent	Agent	Basic agent information


Sample Transformation

Gladly conversation item:

json
{
  "id": "ybP4szYCSy6LdV4DNwEd6g",
  "conversationId": "9BcE2O0DQ2ynGHRmk9FeoA",
  "customerId": "OOrlNMXeS72gs_WEX2TtMg",
  "timestamp": "2023-07-01T11:46:45.01Z",
  "initiator": {
    "id": "OOrlNMXeS72gs_WEX2TtMg",
    "type": "CUSTOMER"
  },
  "content": {
    "type": "CHAT_MESSAGE",
    "sessionId": "5k04bYuTRGqyT6uoSQfWVA",
    "content": "Hi! I know it's after hours but can someone help upgrade my account?"
  }
}

Transformed to Enterpret format:

json
{
  "id": "gladly_9BcE2O0DQ2ynGHRmk9FeoA",
  "source": "Gladly",
  "channel": "chat",
  "timestamp": "2023-07-01T11:46:45.01Z",
  "customer": {
    "id": "OOrlNMXeS72gs_WEX2TtMg",
    "email": "customer@example.com"
  },
  "agent": {
    "id": "WmeA3Y51Q5ayCAaZ1AotIA",
    "name": "Amy Agent"
  },
  "content": "Hi! I know it's after hours but can someone help upgrade my account?",
  "tags": ["Account", "Upgrade"],
  "metadata": {
    "gladly_conversation_id": "9BcE2O0DQ2ynGHRmk9FeoA",
    "gladly_item_id": "ybP4szYCSy6LdV4DNwEd6g"
  }
}

Error Handling

The integration implements robust error handling:

API Rate Limiting: Respects Gladly's rate limits with exponential backoff
Connection Issues: Retries with configurable limits and delays
Data Validation: Validates both source and transformed data
Partial Failures: Continues processing other records if one fails
State Management: Only updates last import timestamp on successful completion

Monitoring and Logging

Comprehensive logging captures:

Import start/end times and summary metrics
Detailed operation logs (API calls, transformations)
Warnings and errors with contextual information
Performance metrics (duration, throughput)

Logs are written to:

Console (formatted for readability)
Log files (rotated daily)
Error-specific logs (for easier troubleshooting)

Future Enhancements

Potential improvements for future versions:

Support for webhook-based real-time imports
Advanced filtering options (by conversation type, topics, etc.)
Performance optimizations for very large datasets
Custom field mapping configuration
Integration with monitoring systems (Datadog, Prometheus)
