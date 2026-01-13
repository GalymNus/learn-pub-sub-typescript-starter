#!/bin/bash

start_or_run () {
    docker inspect rabbitmq-stomp > /dev/null 2>&1

    if [ $? -eq 0 ]; then
        echo "Starting rabbitmq_stomp container..."
        docker start rabbitmq-stomp
    else
        echo "rabbitmq_stomp container not found, creating a new one..."
        docker run -d --name rabbitmq-stomp -p 5672:5672 -p 15672:15672 -p 61613:61613 rabbitmq-stomp:latest
    fi
}

case "$1" in
    start)
        start_or_run
        ;;
    stop)
        echo "Stopping rabbitmq_stomp container..."
        docker stop rabbitmq-stomp
        ;;
    logs)
        echo "Fetching logs for Peril rabbitmq_stomp container..."
        docker logs -f rabbitmq-stomp
        ;;
    *)
        echo "Usage: $0 {start|stop|logs}"
        exit 1
esac
