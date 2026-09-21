import React from 'react';
import Hero from './Hero.jsx';
import CreateRoomContainer from './createRoomContainer/CreateRoomContainer.jsx';

class MainView extends React.Component {
  render() {
    return (
      <div>
        <Hero />
        <CreateRoomContainer
          searchUsers={this.props.searchUsers}
          searchedUsers={this.props.searchedUsers}
          loggedIn={this.props.loggedIn}
          loggedInUser={this.props.loggedInUser}
        />
      </div>
    );
  }
}

export default MainView;
