ACR=timebookacr739ffb.azurecr.io
IMAGE=timebook-backend
TAG=latest

.PHONY: build push build-push

build:
	docker build -f Dockerfile.backend -t $(IMAGE) .

push:
	docker tag $(IMAGE) $(ACR)/$(IMAGE):$(TAG)
	docker push $(ACR)/$(IMAGE):$(TAG)

build-push:
	docker buildx build --platform linux/amd64 -f Dockerfile.backend -t $(ACR)/$(IMAGE):$(TAG) --push .