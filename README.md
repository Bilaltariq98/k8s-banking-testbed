# Kubernetes Banking Testbed

This monorepo contains... 

## frontend 

Dummy UI for banking services to be used in example problems

## istio (not a service)

Bootstrap yaml templates for getting Isito addons running. 

## monitoring 

Exposes K8s data for monitoring as a REST endpoint 

## rest-services 

Rest services used by the frontend and each other. 

## testdata 

Service which creates the test dataset to be used by the microservices.

## tests

Tests for rest-services

## Temp Notes for CI Development 

Temp - docker commands needed to build each of the containers. 

docker build -t guzo/banking-accounts -f ./rest-services/Dockerfile --build-arg REST_SERVICE=instances/accounts.js ./rest-services
docker build -t guzo/banking-contacts -f ./rest-services/Dockerfile --build-arg REST_SERVICE=instances/contacts.js ./rest-services
docker build -t guzo/banking-customer -f ./rest-services/Dockerfile --build-arg REST_SERVICE=instances/customer.js ./rest-services
docker build -t guzo/banking-transactions -f ./rest-services/Dockerfile --build-arg REST_SERVICE=instances/transactions.js ./rest-services

<!-- docker build -t guzo/banking-frontend -f ./frontend/Dockerfile ./frontend -->
<!-- docker build -t guzo/banking-monitoring -f ./monitoring/Dockerfile ./monitoring -->
<!-- docker build -t guzo/banking-testdata -f ./testdata/Dockerfile ./testdata -->
docker build -t guzo/banking-tests -f ./tests/Dockerfile ./tests