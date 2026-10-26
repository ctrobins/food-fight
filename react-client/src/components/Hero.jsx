import React from 'react';

class Hero extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <section className="hero is-primary home-hero">
        <div className="hero-body">
          <h1 className="title is-1">Food Fight!</h1>
          <h2 className="subtitle is-4">Stop bickering over where to eat...and start fighting!</h2>
        </div>
      </section>
    );
  }
}
export default Hero;
