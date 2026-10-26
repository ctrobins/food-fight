import React from 'react';
import Hero from './Hero.jsx';
import CreateRoomContainer from './createRoomContainer/CreateRoomContainer.jsx';

class MainView extends React.Component {
  render() {
    return (
      <div>
        <Hero />
        <CreateRoomContainer
          loggedIn={this.props.loggedIn}
          loggedInUser={this.props.loggedInUser}
        />
      </div>
    );
  }
}

export default MainView;
