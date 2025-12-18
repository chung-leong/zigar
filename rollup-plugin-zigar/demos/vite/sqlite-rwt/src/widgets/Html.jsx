function Html({ content }) {
    return <div className="Html" dangerouslySetInnerHTML={{ __html: content }} />
}

export default Html;