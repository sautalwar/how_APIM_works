using '../main.bicep'

param environment = 'prod'
param publisherEmail = 'api-platform@contoso.com'
param publisherName = 'Contoso API Platform'
param tenantId = '<YOUR-TENANT-ID>'
param apiAudience = '<YOUR-API-CLIENT-ID>'
param backendUrl = 'https://products-api-prod.azurewebsites.net'
param apimSku = 'Standard'
