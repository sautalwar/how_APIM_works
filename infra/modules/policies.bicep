// modules/policies.bicep — APIM Policy Assignments

@description('Name of the existing APIM instance')
param apimName string

@description('Name of the API to apply policies to')
param apiName string

@description('Azure AD Tenant ID')
param tenantId string

@description('API Audience (Client ID)')
param apiAudience string

resource apim 'Microsoft.ApiManagement/service@2023-09-01-preview' existing = {
  name: apimName
}

resource api 'Microsoft.ApiManagement/service/apis@2023-09-01-preview' existing = {
  parent: apim
  name: apiName
}

// Global Policy (all APIs)
resource globalPolicy 'Microsoft.ApiManagement/service/policies@2023-09-01-preview' = {
  parent: apim
  name: 'policy'
  properties: {
    format: 'rawxml'
    value: loadTextContent('../../policies/global-policy.xml')
  }
}

// API-Level Policy (Products API)
resource apiPolicy 'Microsoft.ApiManagement/service/apis/policies@2023-09-01-preview' = {
  parent: api
  name: 'policy'
  properties: {
    format: 'rawxml'
    value: loadTextContent('../../policies/api-level-policy.xml')
  }
}

// Operation-Level Policy (DELETE /products/{id})
resource deleteOperation 'Microsoft.ApiManagement/service/apis/operations@2023-09-01-preview' existing = {
  parent: api
  name: 'delete-product'
}

resource deletePolicy 'Microsoft.ApiManagement/service/apis/operations/policies@2023-09-01-preview' = {
  parent: deleteOperation
  name: 'policy'
  properties: {
    format: 'rawxml'
    value: loadTextContent('../../policies/operation-level-policy.xml')
  }
}

// Policy Fragments
resource jwtFragment 'Microsoft.ApiManagement/service/policyFragments@2023-09-01-preview' = {
  parent: apim
  name: 'jwt-validation'
  properties: {
    description: 'Reusable JWT/OAuth 2.0 token validation'
    format: 'rawxml'
    value: loadTextContent('../../policies/fragments/jwt-validation.xml')
  }
}

resource rateLimitFragment 'Microsoft.ApiManagement/service/policyFragments@2023-09-01-preview' = {
  parent: apim
  name: 'rate-limiting'
  properties: {
    description: 'Reusable rate limiting and quota enforcement'
    format: 'rawxml'
    value: loadTextContent('../../policies/fragments/rate-limiting.xml')
  }
}

resource corsFragment 'Microsoft.ApiManagement/service/policyFragments@2023-09-01-preview' = {
  parent: apim
  name: 'cors-secure'
  properties: {
    description: 'Secure CORS configuration (no wildcards)'
    format: 'rawxml'
    value: loadTextContent('../../policies/fragments/cors-secure.xml')
  }
}

resource sanitizationFragment 'Microsoft.ApiManagement/service/policyFragments@2023-09-01-preview' = {
  parent: apim
  name: 'response-sanitization'
  properties: {
    description: 'Strip internal headers and add security headers'
    format: 'rawxml'
    value: loadTextContent('../../policies/fragments/response-sanitization.xml')
  }
}
