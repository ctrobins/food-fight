locals {
  name          = "${var.project}-${var.environment}"
  https_enabled = var.domain_name != "" && var.route53_zone_id != ""
  app_domain    = local.https_enabled ? "https://${var.domain_name}/" : "http://${aws_lb.app.dns_name}/"

  secret_keys = [
    "DB_PASSWORD",
    "SESSION_SECRET",
    "GOOGLE_AUTH_CLIENT_ID",
    "GOOGLE_AUTH_CLIENT_SECRET",
    "GMAIL_ADDRESS",
    "GMAIL_PASSWORD",
    "YELP_API_KEY",
    "MAILJET_API_KEY",
    "MAILJET_API_SECRET",
  ]
}

resource "terraform_data" "domain_requirements" {
  lifecycle {
    precondition {
      condition     = var.domain_name == "" || var.route53_zone_id != ""
      error_message = "Set route53_zone_id when domain_name is set so Terraform can validate the TLS certificate."
    }
  }
}
