// modules/apim.bicep — Azure API Management Instance

@description('APIM resource name')
param name string

@description('Azure region')
param location string

@description('APIM SKU tier')
param sku string

@description('Publisher email address')
param publisherEmail string

@description('Publisher organization name')
param publisherName string

@description('Resource tags')
param tags object = {}

@description('Azure AD Tenant ID for Named Values')
param tenantId string = ''

@description('API Audience for Named Values')
param apiAudience string = ''

resource apim 'Microsoft.ApiManagement/service@2023-09-01-preview' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: sku
    capacity: sku == 'Consumption' ? 0 : 1
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    publisherEmail: publisherEmail
    publisherName: publisherName
    customProperties: {
      // Enforce TLS 1.2 minimum
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Protocols.Tls10': 'false'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Protocols.Tls11': 'false'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Protocols.Ssl30': 'false'
      // Disable weak ciphers
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Ciphers.TripleDes168': 'false'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Backend.Protocols.Tls10': 'false'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Backend.Protocols.Tls11': 'false'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Backend.Protocols.Ssl30': 'false'
    }
  }
}

// Application Insights for monitoring
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${name}-insights'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    RetentionInDays: 90
  }
}

// Link App Insights to APIM
resource apimLogger 'Microsoft.ApiManagement/service/loggers@2023-09-01-preview' = {
  parent: apim
  name: 'app-insights-logger'
  properties: {
    loggerType: 'applicationInsights'
    credentials: {
      instrumentationKey: appInsights.properties.InstrumentationKey
    }
    isBuffered: true
  }
}

// Enable diagnostics logging
resource apimDiagnostics 'Microsoft.ApiManagement/service/diagnostics@2023-09-01-preview' = {
  parent: apim
  name: 'applicationinsights'
  properties: {
    loggerId: apimLogger.id
    alwaysLog: 'allErrors'
    sampling: {
      samplingType: 'fixed'
      percentage: 100
    }
    frontend: {
      request: {
        headers: ['X-Correlation-Id']
        body: { bytes: 1024 }
      }
      response: {
        headers: ['X-Correlation-Id']
        body: { bytes: 1024 }
      }
    }
    backend: {
      request: {
        headers: ['X-Correlation-Id']
        body: { bytes: 1024 }
      }
      response: {
        headers: ['X-Correlation-Id']
        body: { bytes: 1024 }
      }
    }
  }
}

// Named Values for policy variable substitution ({{tenant-id}}, {{api-audience}})
resource namedValueTenantId 'Microsoft.ApiManagement/service/namedValues@2023-09-01-preview' = if (!empty(tenantId)) {
  parent: apim
  name: 'tenant-id'
  properties: {
    displayName: 'tenant-id'
    value: tenantId
    secret: false
  }
}

resource namedValueApiAudience 'Microsoft.ApiManagement/service/namedValues@2023-09-01-preview' = if (!empty(apiAudience)) {
  parent: apim
  name: 'api-audience'
  properties: {
    displayName: 'api-audience'
    value: apiAudience
    secret: false
  }
}

output apimName string = apim.name
output apimId string = apim.id
output gatewayUrl string = apim.properties.gatewayUrl
output managedIdentityPrincipalId string = apim.identity.principalId
