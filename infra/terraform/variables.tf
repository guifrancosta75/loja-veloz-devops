variable "region" {
  type    = string
  default = "sa-east-1"
}
variable "ambiente" {
  type    = string
  default = "prod"
}
variable "cluster_name" {
  type    = string
  default = "loja-veloz"
}
variable "k8s_version" {
  type    = string
  default = "1.30"
}
variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}
variable "node_instance_types" {
  type    = list(string)
  default = ["t3.large"]
}
variable "node_min" {
  type    = number
  default = 2
}
variable "node_max" {
  type    = number
  default = 6
}
variable "node_desired" {
  type    = number
  default = 3
}
