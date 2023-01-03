#!/bin/bash

VERSION=$(npm run version --silent)
git tag -a $VERSION -m "new version"
git push origin $VERSION