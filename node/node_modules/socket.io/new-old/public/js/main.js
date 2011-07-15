function getMembers(data){
  if (!(data && data.query && data.query.results && data.query.results.p)) return;
  var members = document.createElement('span');
  members.id = 'google-members-count';
  members.innerHTML = '('+ data.query.results.p +' members)';
  document.getElementsByTagName('FORM')[0].insertBefore(members, document.getElementById('google-subscribe-input'));
};

window.onload = function(){
  document.getElementById('google-subscribe-email').onfocus = function(){
    document.getElementById('google-subscribe-input').className = 'focus';
  };
  document.getElementById('google-subscribe-email').onblur = function(){
    document.getElementById('google-subscribe-input').className = '';
  };

  // lame jsonp
  var script = document.createElement('script');
  // yql: select * from html where url="http://groups.google.com/group/socket_io/about" and xpath='//div[@class=\'maincontbox\']/table/tr[1]/td/p[1]
  script.src = "http://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20html%20where%20url%3D%22http%3A%2F%2Fgroups.google.com%2Fgroup%2Fsocket_io%2Fabout%22%20and%20xpath%3D'%2F%2Fdiv%5B%40class%3D%5C'maincontbox%5C'%5D%2Ftable%2Ftr%5B1%5D%2Ftd%2Fp%5B1%5D'%0A&format=json&callback=getMembers";
  document.head.appendChild(script);
};
