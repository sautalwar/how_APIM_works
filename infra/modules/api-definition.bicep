// modules/api-definition.bicep — Products API definition in APIM

@description('Name of the existing APIM instance')
param apimName string

@description('Backend API base URL')
param backendUrl string

@description('Azure AD Tenant ID')
param tenantId string

@description('API Audience (Client ID)')
param apiAudience string

var apiName = 'products-api'

resource apim 'Microsoft.ApiManagement/service@2023-09-01-preview' existing = {
  name: apimName
}

// API Definition
resource api 'Microsoft.ApiManagement/service/apis@2023-09-01-preview' = {
  parent: apim
  name: apiName
  properties: {
    displayName: 'Products API'
    description: 'CRUD API for product management — secured by APIM policies'
    path: 'products'
    protocols: ['https']
    subscriptionRequired: true
    subscriptionKeyParameterNames: {
      header: 'Ocp-Apim-Subscription-Key'
      query: 'subscription-key'
    }
    serviceUrl: backendUrl
    isCurrent: true
  }
}

// GET /api/products — List products
resource listProducts 'Microsoft.ApiManagement/service/apis/operations@2023-09-01-preview' = {
  parent: api
  name: 'list-products'
  properties: {
    displayName: 'List Products'
    method: 'GET'
    urlTemplate: '/api/products'
    description: 'Retrieve a paginated list of products'
    responses: [
      {
        statusCode: 200
        description: 'Success'
      }
    ]
  }
}

// GET /api/products/{id} — Get product
resource getProduct 'Microsoft.ApiManagement/service/apis/operations@2023-09-01-preview' = {
  parent: api
  name: 'get-product'
  properties: {
    displayName: 'Get Product'
    method: 'GET'
    urlTemplate: '/api/products/{id}'
    description: 'Retrieve a single product by ID'
    templateParameters: [
      {
        name: 'id'
        required: true
        type: 'string'
        description: 'Product ID'
      }
    ]
  }
}

// POST /api/products — Create product
resource createProduct 'Microsoft.ApiManagement/service/apis/operations@2023-09-01-preview' = {
  parent: api
  name: 'create-product'
  properties: {
    displayName: 'Create Product'
    method: 'POST'
    urlTemplate: '/api/products'
    description: 'Create a new product'
  }
}

// PUT /api/products/{id} — Update product
resource updateProduct 'Microsoft.ApiManagement/service/apis/operations@2023-09-01-preview' = {
  parent: api
  name: 'update-product'
  properties: {
    displayName: 'Update Product'
    method: 'PUT'
    urlTemplate: '/api/products/{id}'
    description: 'Update an existing product'
    templateParameters: [
      {
        name: 'id'
        required: true
        type: 'string'
        description: 'Product ID'
      }
    ]
  }
}

// DELETE /api/products/{id} — Delete product (admin only)
resource deleteProduct 'Microsoft.ApiManagement/service/apis/operations@2023-09-01-preview' = {
  parent: api
  name: 'delete-product'
  properties: {
    displayName: 'Delete Product'
    method: 'DELETE'
    urlTemplate: '/api/products/{id}'
    description: 'Delete a product (requires Admin role)'
    templateParameters: [
      {
        name: 'id'
        required: true
        type: 'string'
        description: 'Product ID'
      }
    ]
  }
}

// Product for grouping APIs
resource product 'Microsoft.ApiManagement/service/products@2023-09-01-preview' = {
  parent: apim
  name: 'products-api-product'
  properties: {
    displayName: 'Products API'
    description: 'Access to the Products API'
    subscriptionRequired: true
    approvalRequired: true
    state: 'published'
  }
}

// Link API to product
resource productApi 'Microsoft.ApiManagement/service/products/apis@2023-09-01-preview' = {
  parent: product
  name: apiName
  dependsOn: [api]
}

output apiName string = api.name
output apiId string = api.id
