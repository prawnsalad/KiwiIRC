# -*- mode: ruby -*-
# vi: set ft=ruby :

# All Vagrant configuration is done below. The "2" in Vagrant.configure
# configures the configuration version (we support older styles for
# backwards compatibility). Please don't change it unless you know what
# you're doing.
Vagrant.configure(2) do |config|
  # The most common configuration options are documented and commented below.
  # For a complete reference, please see the online documentation at
  # https://docs.vagrantup.com.

  # Every Vagrant development environment requires a box. You can search for
  # boxes at https://atlas.hashicorp.com/search.
  config.vm.box = "debian/jessie64"

  # A file that configures KiwiIRC with steps given in README.md
  config.vm.provision "shell", keep_color: true, path: "vagrant/provision.sh"

  # Forwarding default KiwiIRC port so that host can access it through the browser
  config.vm.network :forwarded_port, guest: 7778, host: 7778
end
