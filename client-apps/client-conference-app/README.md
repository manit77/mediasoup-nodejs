#

Conferencing Application Client Side
- User
  - userName
  - emailAddress
  - displayName
  - authToken
- Participant
  - userId
  - displayName
  - peerId
- Conference
  - conferenceId
  - conferenceCode
  - maxParticipants
  - isRecorded
  - dateStart
  - dateEnd  
  
Conferencing Application Server
- Users //authenticated users inside the application
  - userId
  - displayName
  - emailAddress
  - userName
  - passwordHash
- Conferences //has dates for scheduling constraints for the conference
  - conferenceId
  - conferenceCode
  - maxParticipants
  - isRecorded
  - dateStart
  - dateEnd
  - participants[] //users in a confence

Room Server - SFU Media Server
- Room
  - roomId
  - peers[]
- Peer : authenticated user based on authtoken authentication. no database for peers.
  -  peerId
  -  displayName
  -  room
-  Transports
   -  consumerTransport
   -  producerTransport
-  Consumer
-  Producer