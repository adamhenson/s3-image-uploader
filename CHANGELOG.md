# changelog

## 0.0.6

- Fix bug. Define 'self' in 'writeImage_'.

## 0.0.7

- Fix bug. Remove 'self' in 'writeImage_' and websockets messaging in this function as it's not needed.

## 0.0.8

- Allow resize of only one side (width or height), and the other side to be sized according to aspect ratio. Also, remove logging.

## 0.0.9

- Allow max file size on upload function.

## 0.1.0

- Refactor WebSocket functionality and add logging option.

## 0.1.13

- Fix logging.

## 0.1.16

- Fix file validation. Catch undefined header.

## 0.1.17

- Addition to 0.1.16 - add mimetype catch.

## 0.1.18

- Fix undefined parameter.

## 0.1.19

- Fix issue #1. Now a developer can extend the S3 object with valid params.

## 1.0.0

- Made setup easier by replacing required `server` option with optional `websocketServer` option.
- Renamed options to be more intuitive. Replaced `port` with `websocketServerPort`.
- Removed boolean `websocket` option and replaced the check to simply read the `websocketServer` option for existence.

## 1.0.1

- Add `getSize` method.

## 1.0.2

- Updated readme.

## 1.0.3

- Add `delete` method.

## 1.0.4

- Badges.