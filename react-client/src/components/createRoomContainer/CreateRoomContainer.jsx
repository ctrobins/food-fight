import React from 'react';
import SearchUsersPanel from './SearchInvite/SearchUsersPanel.jsx';
import CreateRoom from './CreateRoom.jsx';

class CreateRoomContainer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      combatants: props.loggedInUser ? [props.loggedInUser] : [],
    };
  }

  componentDidUpdate(prevProps) {
    const nextUser = this.props.loggedInUser;
    if (nextUser && nextUser !== prevProps.loggedInUser) {
      this.addCombatant(nextUser);
    } else if (!nextUser && prevProps.loggedInUser) {
      this.setState({ combatants: [] });
    }
  }

  addCombatant(email) {
    this.setState((state) => {
      if (state.combatants.includes(email)) {
        return null;
      }
      return { combatants: [...state.combatants, email] };
    });
  }

  render() {
    return (
      <div id="site-body" className="tile is-ancestor" >
        <div className="tile is-parent is-vertical">
          <SearchUsersPanel
            combatants={this.state.combatants}
            addCombatant={this.addCombatant.bind(this)} />
        </div>
        <div className="tile is-parent is-vertical is-8">
          <article className="tile is-child notification create-room-container">
            <div>
              <CreateRoom
                combatants={this.state.combatants}
                loggedIn={this.props.loggedIn}
                loggedInUser={this.props.loggedInUser} />
            </div>
          </article>
        </div>
      </div >
    )
  }
}

export default CreateRoomContainer;