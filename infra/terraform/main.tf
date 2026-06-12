data "aws_ami" "ubuntu_arm" {
  most_recent = true
  owners      = ["099720109477"] # Canonical
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-arm64-server-*"]
  }
}

resource "aws_security_group" "zerospam" {
  name        = "zerospam-sg"
  description = "ZeroSpam: SSH(restricted), SMTP, HTTP/S"

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_ingress_cidr]
  }
  ingress {
    description = "SMTP"
    from_port   = 25
    to_port     = 25
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Instance role: read SSM params under /zerospam/prod/*
resource "aws_iam_role" "instance" {
  name = "zerospam-instance"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [{ Action = "sts:AssumeRole", Effect = "Allow", Principal = { Service = "ec2.amazonaws.com" } }]
  })
}

resource "aws_iam_role_policy" "ssm_read" {
  name = "ssm-read"
  role = aws_iam_role.instance.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
      Action = ["ssm:GetParametersByPath", "ssm:GetParameter", "ssm:GetParameters"],
      # GetParametersByPath authorizes against the PATH node itself, not just the
      # children — so both ARNs are required (the bare path AND the /* wildcard).
      Resource = [
        "arn:aws:ssm:${var.region}:*:parameter/zerospam/prod",
        "arn:aws:ssm:${var.region}:*:parameter/zerospam/prod/*"
      ]
    }]
  })
}

resource "aws_iam_instance_profile" "instance" {
  name = "zerospam-instance"
  role = aws_iam_role.instance.name
}

resource "aws_instance" "zerospam" {
  ami                    = data.aws_ami.ubuntu_arm.id
  instance_type          = var.instance_type
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.zerospam.id]
  iam_instance_profile   = aws_iam_instance_profile.instance.name
  user_data              = templatefile("${path.module}/cloud-init.yaml.tftpl", { repo_url = var.repo_url, region = var.region, deploy_branch = var.deploy_branch })
  root_block_device {
    volume_size = 16
    volume_type = "gp3"
  }
  tags = { Name = "zerospam" }

  lifecycle {
    # The instance is stateful (SQLite + raw mail live on the attached EBS volume).
    # Don't let cloud-init edits or a newer "most_recent" AMI force a destroy/replace
    # of the running mail server — rebuild deliberately (terraform taint) when needed.
    ignore_changes = [user_data, ami]
  }
}

resource "aws_eip" "zerospam" {
  instance = aws_instance.zerospam.id
  domain   = "vpc"
  tags     = { Name = "zerospam" }
}

resource "aws_ebs_volume" "data" {
  availability_zone = aws_instance.zerospam.availability_zone
  size              = var.data_volume_gb
  type              = "gp3"
  tags              = { Name = "zerospam-data", Snapshot = "daily" }
}

resource "aws_volume_attachment" "data" {
  device_name = "/dev/sdf"
  volume_id   = aws_ebs_volume.data.id
  instance_id = aws_instance.zerospam.id
}

# Nightly snapshot of volumes tagged Snapshot=daily
resource "aws_iam_role" "dlm" {
  name = "zerospam-dlm"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [{ Action = "sts:AssumeRole", Effect = "Allow", Principal = { Service = "dlm.amazonaws.com" } }]
  })
}

resource "aws_iam_role_policy_attachment" "dlm" {
  role       = aws_iam_role.dlm.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSDataLifecycleManagerServiceRole"
}

resource "aws_dlm_lifecycle_policy" "data" {
  description        = "zerospam daily data snapshots"
  execution_role_arn = aws_iam_role.dlm.arn
  state              = "ENABLED"
  policy_details {
    resource_types = ["VOLUME"]
    target_tags    = { Snapshot = "daily" }
    schedule {
      name = "daily-7"
      create_rule {
        interval      = 24
        interval_unit = "HOURS"
        times         = ["05:00"]
      }
      retain_rule {
        count = 7
      }
    }
  }
}
