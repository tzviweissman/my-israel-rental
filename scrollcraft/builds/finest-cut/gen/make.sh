#!/bin/sh
# Rebuild the site from the build folder: sh gen/make.sh
cat gen/base.css gen/own.css > site.css
python gen/build.py
