import GroupJournalPanel from './GroupJournalPanel.jsx'

function GroupSchedulePanel({ groupId, canManage, onJournalChange }) {
  return (
    <GroupJournalPanel
      groupId={groupId}
      canManage={canManage}
      onJournalChange={onJournalChange}
    />
  )
}

export default GroupSchedulePanel
