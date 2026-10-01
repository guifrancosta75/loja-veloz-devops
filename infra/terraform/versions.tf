terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
  # Estado remoto com lock (descomente após criar o bucket e a tabela):
  # backend "s3" {
  #   bucket         = "loja-veloz-tfstate"
  #   key            = "eks/terraform.tfstate"
  #   region         = "sa-east-1"
  #   dynamodb_table = "loja-veloz-tflock"
  #   encrypt        = true
  # }
}
provider "aws" {
  region = var.region
  default_tags { tags = { projeto = "loja-veloz", ambiente = var.ambiente, gerenciado-por = "terraform" } }
}
