FROM node:lts-stretch

LABEL maintainer="Colin Wilson (colin@aig.is)"
LABEL vendor="AIGIS Services Ltd"

# Set the work directory
RUN mkdir -p /var/www/app
WORKDIR /var/www/app

# Add our package.json and install *before* adding our application files
ADD app/package.json ./
RUN npm i --production

# Add application files
ADD app /var/www/app

EXPOSE 3000

CMD ["start", "process.json", "--no-daemon"]