@description('The location into which your Azure resources should be deployed.')
param location string = resourceGroup().location

@description('The name of the environment. This must be dev, test, or prod.')
@allowed([
  'dev'
  'test'
  'prod'
])
param environmentName string

@description('A unique suffix to add to resource names that need to be globally unique.')
@maxLength(13)
param resourceToken string = uniqueString(subscription().id, environmentName)

// User assigned managed identity for Container Apps
resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${resourceToken}'
  location: location
  tags: tags
}

param containerRegistryName string = 'cr${resourceToken}'
param applicationInsightsName string = 'appi-${resourceToken}'
param logAnalyticsName string = 'log-${resourceToken}'
param containerappEnvName string = 'cae-${resourceToken}'
param keyVaultName string = 'kv-${resourceToken}'
param staticWebAppName string = 'swa-${resourceToken}'
param backendAppName string = 'app-${resourceToken}'
param dbServerName string = 'psql-${resourceToken}'
param dbName string = 'bankfin'
param dbAdminUsername string = 'bankfin_admin'
@secure()
param dbAdminPassword string
@secure()
param jwtSecret string
@secure()
param kycApiKey string
@secure()
param logAnalyticsSharedKey string = ''

// Tags that should be applied to all resources.
var tags = {
  'azd-env-name': environmentName
}

// Monitor application with Azure Monitor
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  tags: tags
  properties: {
    retentionInDays: 30
    features: {
      searchVersion: 1
    }
    sku: {
      name: 'PerGB2018'
    }
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: applicationInsightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

// Container apps host (including container registry)
resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: containerRegistryName
  location: location
  tags: tags
  sku: {
    name: 'Premium'
  }
  properties: {
    adminUserEnabled: false
    dataEndpointEnabled: false
    encryption: {
      status: 'disabled'
    }
    networkRuleBypassOptions: 'AzureServices'
    publicNetworkAccess: 'Enabled'
    zoneRedundancy: 'Disabled'
  }
}

// Grant AcrPull role to the managed identity
resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerRegistry.id, managedIdentity.id, 'acrpull')
  scope: containerRegistry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalId: managedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource containerAppEnv 'Microsoft.App/managedEnvironments@2022-10-01' = {
  name: containerappEnvName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: empty(logAnalyticsSharedKey) ? logAnalytics.listKeys().primarySharedKey : logAnalyticsSharedKey
      }
    }
  }
}

// Key vault for storing secrets
resource keyVault 'Microsoft.KeyVault/vaults@2022-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enabledForTemplateDeployment: true
  }
}

// PostgreSQL database server
resource dbServer 'Microsoft.DBforPostgreSQL/flexibleServers@2022-12-01' = {
  name: dbServerName
  location: location
  tags: tags
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: dbAdminUsername
    administratorLoginPassword: dbAdminPassword
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    network: {
      delegatedSubnetResourceId: ''
      privateDnsZoneArmResourceId: ''
    }
    highAvailability: {
      mode: 'Disabled'
    }
    version: '15'
  }

  resource database 'databases' = {
    name: dbName
  }
}

// Give the app access to KeyVault
resource keyVaultPolicy 'Microsoft.KeyVault/vaults/accessPolicies@2022-07-01' = {
  name: 'add'
  parent: keyVault
  properties: {
    accessPolicies: [
      {
        tenantId: subscription().tenantId
        objectId: backendApp.identity.principalId
        permissions: {
          secrets: [ 'get', 'list' ]
        }
      }
    ]
  }
}

// Create secrets in Key Vault
module jwtSecretValue 'secret.bicep' = {
  name: 'jwt-secret'
  params: {
    name: 'jwt-secret'
    keyVault: keyVault
    value: jwtSecret
  }
}

module kycApiKeyValue 'secret.bicep' = {
  name: 'kyc-api-key'
  params: {
    name: 'kyc-api-key'
    keyVault: keyVault
    value: kycApiKey
  }
}

module dbConnectionValue 'secret.bicep' = {
  name: 'db-connection'
  params: {
    name: 'db-connection'
    keyVault: keyVault
    value: 'postgresql://${dbAdminUsername}:${dbAdminPassword}@${dbServer.properties.fullyQualifiedDomainName}/${dbName}'
  }
}

// Backend API app
resource backendApp 'Microsoft.App/containerApps@2022-10-01' = {
  name: backendAppName
  location: location
  tags: union(tags, {
    'azd-service-name': 'bankfin-api'
  })
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8000
        transport: 'http'
        allowInsecure: false
        corsPolicy: {
          allowedOrigins: ['https://${staticWebApp.properties.defaultHostname}']
          allowedMethods: ['*']
          allowedHeaders: ['*']
          allowCredentials: true
        }
      }
      registries: [
        {
          server: '${containerRegistry.name}.azurecr.io'
          identity: managedIdentity.id
        }
      ]
    }
    template: {
      containers: [
        {
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          name: 'bankfin-api'
          env: [
            {
              name: 'DATABASE_URL'
              secretRef: 'db-connection'
            }
            {
              name: 'JWT_SECRET'
              secretRef: 'jwt-secret'
            }
            {
              name: 'KYC_API_KEY'
              secretRef: 'kyc-api-key'
            }
            {
              name: 'DEBUG'
              value: environmentName == 'prod' ? 'false' : 'true'
            }
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              value: appInsights.properties.ConnectionString
            }
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          probes: [
            {
              type: 'Readiness'
              httpGet: {
                path: '/docs'
                port: 8000
              }
              initialDelaySeconds: 10
              periodSeconds: 30
            }
            {
              type: 'Liveness'
              httpGet: {
                path: '/docs'
                port: 8000
              }
              initialDelaySeconds: 10
              periodSeconds: 30
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 10
        rules: [
          {
            name: 'http-scale-rule'
            http: {
              metadata: {
                concurrentRequests: '10'
              }
            }
          }
        ]
      }
    }
  }
}

// Frontend web app
resource staticWebApp 'Microsoft.Web/staticSites@2022-09-01' = {
  name: staticWebAppName
  location: location
  tags: union(tags, {
    'azd-service-name': 'bankfin-frontend'
  })
  sku: {
    name: 'Standard'
    size: 'Standard'
  }
  properties: {
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    provider: 'Custom'
    enterpriseGradeCdnStatus: 'Disabled'
  }
}

// Add Log Analytics key to Key Vault
module logAnalyticsKeyValue 'secret.bicep' = {
  name: 'loganalytics-key'
  params: {
    name: 'loganalytics-key'
    keyVault: keyVault
    value: logAnalytics.listKeys().primarySharedKey
  }
}

output AZURE_CONTAINER_REGISTRY_ENDPOINT string = containerRegistry.properties.loginServer
output AZURE_CONTAINER_REGISTRY_NAME string = containerRegistry.name
output BACKEND_URI string = backendApp.properties.configuration.ingress.fqdn
output FRONTEND_URI string = staticWebApp.properties.defaultHostname
output RESOURCE_GROUP_ID string = resourceGroup().id
