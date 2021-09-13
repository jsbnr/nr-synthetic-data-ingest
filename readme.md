# New Relic Synthetic API lookup and ingest
A script for doing simple data lookup and ingest by leveraging the API Synthetics engine to make the requests for us.

## Setup
Add the script to a synthetic monitor. Be sure to add a secure credential "JSON_LOOKUP_INSERT_KEY" which contains you insights insert key. The script can be run locally for testing. Do an `npm install` then `node json_lookup.js`. You should add your API key when testing only temporarily to the indicated place. The actual lookup and marshalling of the data is up to you.