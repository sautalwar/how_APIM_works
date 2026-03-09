// main.bicep — APIM Security Demo Infrastructure
// Deploys: APIM instance + Products API + Security policies

targetScope = 'resourceGroup'

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Environment name (dev/staging/prod)')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'dev'

@description('APIM publisher email')
param publisherEmail string

@description('APIM publisher name')
param publisherName string = 'Contoso API Team'

@description('Azure AD Tenant ID for JWT validation')
param tenantId string

@description('API audience (App Registration Client ID)')
param apiAudience string

@description('Backend API URL')
param backendUrl string

@description('APIM SKU')
@allowed(['Consumption', 'Developer', 'Basic', 'Standard', 'Premium'])
param apimSku string = 'Developer'

// Tags applied to all resources
var tags = {
  environment: environment
  project: 'apim-security-demo'
  managedBy: 'bicep'
}

var apimName = 'apim-security-demo-${environment}-${uniqueString(resourceGroup().id)}'

// Deploy APIM instance
module apim 'modules/apim.bicep' = {
  name: 'apim-deployment'
  params: {
    name: apimName
    location: location
    sku: apimSku
    publisherEmail: publisherEmail
    publisherName: publisherName
    tags: tags
  }
}

// Deploy API definition
module apiDefinition 'modules/api-definition.bicep' = {
  name: 'api-definition-deployment'
  params: {
    apimName: apim.outputs.apimName
    backendUrl: backendUrl
    tenantId: tenantId
    apiAudience: apiAudience
  }
}

// Deploy policies
module policies 'modules/policies.bicep' = {
  name: 'policies-deployment'
  params: {
    apimName: apim.outputs.apimName
    apiName: apiDefinition.outputs.apiName
    tenantId: tenantId
    apiAudience: apiAudience
  }
}

// Outputs
output apimGatewayUrl string = apim.outputs.gatewayUrl
output apimName string = apim.outputs.apimName
output apiName string = apiDefinition.outputs.apiName
