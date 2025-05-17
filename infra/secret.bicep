@description('The name of the secret')
param name string

@description('The Key Vault to store the secret in')
param keyVault object

@secure()
@description('The value of the secret')
param value string

resource secret 'Microsoft.KeyVault/vaults/secrets@2022-07-01' = {
  name: '${keyVault.name}/${name}'
  properties: {
    value: value
  }
}
