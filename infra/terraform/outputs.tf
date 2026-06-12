output "eip" {
  description = "Elastic IP — put this in the A records for zero-spam.email and mail.zero-spam.email"
  value       = aws_eip.zerospam.public_ip
}

output "ses_dkim_cnames" {
  description = "Add each as a CNAME: <token>._domainkey.zero-spam.email -> <token>.dkim.amazonses.com"
  value       = [for t in aws_ses_domain_dkim.zerospam.dkim_tokens : "${t}._domainkey.${var.domain} CNAME ${t}.dkim.amazonses.com"]
}

output "ses_smtp_username" {
  value = aws_iam_access_key.ses_smtp.id
}

output "ses_smtp_password" {
  description = "SES SMTP password (derived). Store in SSM as RELAY_PASS."
  value       = aws_iam_access_key.ses_smtp.ses_smtp_password_v4
  sensitive   = true
}
