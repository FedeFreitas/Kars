(Get-Content page.jsx) | ForEach-Object { '{0,4}: {1}' -f ([array]::IndexOf((Get-Content page.jsx), )+1),  }
