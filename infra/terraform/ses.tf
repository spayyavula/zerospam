resource "aws_ses_domain_identity" "zerospam" {
  domain = var.domain
}

resource "aws_ses_domain_dkim" "zerospam" {
  domain = aws_ses_domain_identity.zerospam.domain
}

# IAM user whose access key is converted to SES SMTP credentials.
resource "aws_iam_user" "ses_smtp" {
  name = "zerospam-ses-smtp"
}

resource "aws_iam_user_policy" "ses_send" {
  name = "ses-send"
  user = aws_iam_user.ses_smtp.name
  policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [{ Effect = "Allow", Action = ["ses:SendRawEmail", "ses:SendEmail"], Resource = "*" }]
  })
}

resource "aws_iam_access_key" "ses_smtp" {
  user = aws_iam_user.ses_smtp.name
}
