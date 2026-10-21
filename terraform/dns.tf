resource "aws_acm_certificate" "app" {
  count = local.https_enabled ? 1 : 0

  domain_name       = var.domain_name
  validation_method = "DNS"
}

resource "aws_route53_record" "cert_validation" {
  for_each = local.https_enabled ? {
    for option in aws_acm_certificate.app[0].domain_validation_options : option.domain_name => {
      name   = option.resource_record_name
      record = option.resource_record_value
      type   = option.resource_record_type
    }
  } : {}

  zone_id         = var.route53_zone_id
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "app" {
  count = local.https_enabled ? 1 : 0

  certificate_arn         = aws_acm_certificate.app[count.index].arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

resource "aws_route53_record" "app" {
  count = local.https_enabled ? 1 : 0

  zone_id = var.route53_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_lb.app.dns_name
    zone_id                = aws_lb.app.zone_id
    evaluate_target_health = true
  }
}
