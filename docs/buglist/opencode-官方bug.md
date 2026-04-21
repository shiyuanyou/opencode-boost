# session directory 不完全匹配的bug

~~~bash
ubuntu@VM-16-16-ubuntu:~$ opencode session list --format json -n 10000 | jq -r '.[].directory'
/home/ubuntu
/home/ubuntu
/home/ubuntu
/home/ubuntu
/home/ubuntu
/home/ubuntu
/home/ubuntu
/home/ubuntu/.opencode/bin
/home/ubuntu
/home/ubuntu/.agents
/home/ubuntu
/home/ubuntu
/home/ubuntu
/home/ubuntu
/home/ubuntu
/home/ubuntu/.config/opencode/agent
/home/ubuntu/tools/social_media
/home/ubuntu/tools/reports_learning
/home/ubuntu/.tmp
/home/ubuntu/.tmp
/home/ubuntu
/home/ubuntu
~~~