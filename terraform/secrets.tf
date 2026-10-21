resource "random_password" "session" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "app" {
  name                    = "${local.name}/app"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    DB_PASSWORD               = random_password.db.result
    SESSION_SECRET            = random_password.session.result
    GOOGLE_AUTH_CLIENT_ID     = var.google_auth_client_id
    GOOGLE_AUTH_CLIENT_SECRET = var.google_auth_client_secret
    GMAIL_ADDRESS             = var.gmail_address
    GMAIL_PASSWORD            = var.gmail_password
    YELP_API_KEY              = var.yelp_api_key
    MAILJET_API_KEY           = var.mailjet_api_key
    MAILJET_API_SECRET        = var.mailjet_api_secret
  })
}
